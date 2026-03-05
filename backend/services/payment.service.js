const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const PaymentModel = require('../models/Payment.model');
const logger = require('../utils/logger.util');

// ─── Create Stripe Payment Intent ─────────────────────────────────────────
async function createStripePaymentIntent({ amount, currency = 'usd', patientId, appointmentId, metadata = {} }) {
  try {
    const intent = await stripe.paymentIntents.create({
      amount  : Math.round(amount * 100), // Stripe uses smallest currency unit (cents)
      currency: currency.toLowerCase(),
      metadata: { patientId, appointmentId, ...metadata },
    });

    await PaymentModel.create({
      patientId,
      appointmentId,
      amount,
      currency: currency.toUpperCase(),
      method  : 'stripe',
      providerRef: intent.id,
    });

    return {
      clientSecret   : intent.client_secret,
      paymentIntentId: intent.id,
    };
  } catch (err) {
    logger.error('Stripe PaymentIntent error:', err.message);
    throw err;
  }
}

// ─── Handle Stripe Webhook ─────────────────────────────────────────────────
async function handleStripeWebhook(payload, signature) {
  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error('Stripe webhook signature failed:', err.message);
    throw new Error('Invalid webhook signature');
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object;
      const payment = await PaymentModel.findByProviderRef(pi.id);
      if (payment) await PaymentModel.updateStatus(payment.id, 'completed');
      logger.info(`Payment completed: ${pi.id}`);
      break;
    }
    case 'payment_intent.payment_failed': {
      const pi = event.data.object;
      const payment = await PaymentModel.findByProviderRef(pi.id);
      if (payment) await PaymentModel.updateStatus(payment.id, 'failed');
      logger.warn(`Payment failed: ${pi.id}`);
      break;
    }
  }
  return { received: true };
}

// ─── MTN Mobile Money (MoMo) ─────────────────────────────────────────────
async function initiateMoMoPayment({ phone, amount, currency = 'UGX', externalId, payerMessage }) {
  try {
    const axios = require('axios');
    const { v4: uuidv4 } = require('uuid');
    const referenceId = uuidv4();
    const baseUrl     = process.env.MTN_MOMO_BASE_URL || 'https://sandbox.momodeveloper.mtn.com';

    // Request to pay
    await axios.post(
      `${baseUrl}/collection/v1_0/requesttopay`,
      {
        amount,
        currency,
        externalId,
        payer       : { partyIdType: 'MSISDN', partyId: phone },
        payerMessage: payerMessage || 'HealthConnect Consultation Payment',
        payeeNote   : 'HealthConnect',
      },
      {
        headers: {
          'Authorization'              : `Bearer ${process.env.MTN_MOMO_API_KEY}`,
          'X-Reference-Id'             : referenceId,
          'X-Target-Environment'       : process.env.NODE_ENV === 'production' ? 'mtnuganda' : 'sandbox',
          'Ocp-Apim-Subscription-Key'  : process.env.MTN_MOMO_SUBSCRIPTION_KEY,
          'Content-Type'               : 'application/json',
        },
      }
    );
    logger.info(`MTN MoMo payment initiated. Reference: ${referenceId}`);
    return { referenceId, status: 'pending' };
  } catch (err) {
    logger.error('MTN MoMo error:', err.message);
    throw err;
  }
}

module.exports = { createStripePaymentIntent, handleStripeWebhook, initiateMoMoPayment };
