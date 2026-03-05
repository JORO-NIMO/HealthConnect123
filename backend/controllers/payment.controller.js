const PaymentService = require('../services/payment.service');
const PaymentModel   = require('../models/Payment.model');
const PatientModel   = require('../models/Patient.model');
const AppointmentModel = require('../models/Appointment.model');
const { sendSuccess, sendError } = require('../utils/response.util');
const logger = require('../utils/logger.util');

// ─── Create Payment Intent (Stripe) ──────────────────────────────────────
exports.createPaymentIntent = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const { appointmentId, amount, currency } = req.body;
    if (!appointmentId || !amount) {
      return sendError(res, 400, 'Appointment ID and amount are required.');
    }

    // Verify appointment belongs to patient
    const appointment = await AppointmentModel.findById(appointmentId);
    if (!appointment || appointment.patient_id !== patient.id) {
      return sendError(res, 404, 'Appointment not found.');
    }

    const result = await PaymentService.createStripePaymentIntent({
      amount: parseFloat(amount),
      currency: currency || 'usd',
      patientId: patient.id,
      appointmentId,
      metadata: { userEmail: req.user.email },
    });

    return sendSuccess(res, 200, 'Payment intent created.', result);
  } catch (err) { next(err); }
};

// ─── Initiate Mobile Money Payment ───────────────────────────────────────
exports.initiateMoMo = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const { appointmentId, phone, amount, currency } = req.body;
    if (!appointmentId || !phone || !amount) {
      return sendError(res, 400, 'Appointment ID, phone number, and amount are required.');
    }

    const appointment = await AppointmentModel.findById(appointmentId);
    if (!appointment || appointment.patient_id !== patient.id) {
      return sendError(res, 404, 'Appointment not found.');
    }

    const result = await PaymentService.initiateMoMoPayment({
      phone,
      amount: parseFloat(amount),
      currency: currency || 'UGX',
      externalId: appointmentId,
      payerMessage: `HealthConnect consultation with Dr. ${appointment.doctor_first_name} ${appointment.doctor_last_name}`,
    });

    // Create payment record
    await PaymentModel.create({
      patientId: patient.id,
      appointmentId,
      amount: parseFloat(amount),
      currency: currency || 'UGX',
      method: 'mtn_momo',
      providerRef: result.referenceId,
    });

    return sendSuccess(res, 200, 'Mobile Money payment initiated. Approve on your phone.', result);
  } catch (err) { next(err); }
};

// ─── Payment History ─────────────────────────────────────────────────────
exports.getHistory = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const { limit = 20, offset = 0 } = req.query;
    const payments = await PaymentModel.listByPatient(patient.id, {
      limit: parseInt(limit), offset: parseInt(offset),
    });

    return sendSuccess(res, 200, 'Payment history retrieved.', { payments });
  } catch (err) { next(err); }
};

// ─── Get Payment for Appointment ─────────────────────────────────────────
exports.getPaymentForAppointment = async (req, res, next) => {
  try {
    const { query: dbQuery, queryOne } = require('../config/database');
    const payment = await queryOne(
      'SELECT * FROM payments WHERE appointment_id = ? ORDER BY created_at DESC LIMIT 1',
      [req.params.appointmentId]
    );
    return sendSuccess(res, 200, 'Payment retrieved.', { payment });
  } catch (err) { next(err); }
};

// ─── Stripe Webhook ──────────────────────────────────────────────────────
exports.stripeWebhook = async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    await PaymentService.handleStripeWebhook(req.body, sig);
    res.json({ received: true });
  } catch (err) {
    logger.error('Stripe webhook error:', err.message);
    res.status(400).json({ error: err.message });
  }
};
