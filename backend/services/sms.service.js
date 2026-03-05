const logger = require('../utils/logger.util');

// Africa's Talking SMS (primary for Africa)
let AT = null;
try {
  const AfricasTalking = require('africastalking');
  if (process.env.AT_API_KEY && process.env.AT_USERNAME) {
    const client = AfricasTalking({
      apiKey  : process.env.AT_API_KEY,
      username: process.env.AT_USERNAME,
    });
    AT = client.SMS;
  }
} catch { /* Optional dependency */ }

// ─── Send SMS ─────────────────────────────────────────────────────────────
async function sendSMS(to, message) {
  if (!to) {
    logger.warn('SMS skipped: no phone number provided');
    return;
  }

  // Normalize phone number to international format
  const phone = normalizePhone(to);

  try {
    if (AT) {
      const result = await AT.send({
        to      : [phone],
        message,
        from    : process.env.AT_SENDER_ID || 'HealthConnect',
      });
      logger.info(`SMS sent via Africa's Talking to ${phone}`);
      return result;
    } else {
      // Fallback: log SMS for development
      logger.info(`[SMS DEV] To: ${phone} | Message: ${message}`);
    }
  } catch (err) {
    logger.error(`SMS send failed to ${phone}:`, err.message);
  }
}

// ─── OTP SMS ──────────────────────────────────────────────────────────────
async function sendOTP(phone, otp) {
  const message = `Your HealthConnect verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`;
  return sendSMS(phone, message);
}

// ─── Appointment Reminder SMS ─────────────────────────────────────────────
async function sendAppointmentSMS(appointment) {
  const message = `HealthConnect: Appointment confirmed with Dr. ${appointment.doctor_last_name} on ${appointment.appointment_date} at ${appointment.appointment_time}. Type: ${appointment.type}. Reply CANCEL to cancel.`;
  return sendSMS(appointment.patient_phone, message);
}

// ─── Appointment Reminder ─────────────────────────────────────────────────
async function sendAppointmentReminder(appointment) {
  const message = `HealthConnect Reminder: You have an appointment in 1 hour with Dr. ${appointment.doctor_last_name} at ${appointment.appointment_time}. Prepare your video connection.`;
  return sendSMS(appointment.patient_phone, message);
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function normalizePhone(phone) {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return '+254' + cleaned.substring(1); // Default: Kenya
  }
  if (!cleaned.startsWith('+')) return '+' + cleaned;
  return phone;
}

module.exports = { sendSMS, sendOTP, sendAppointmentSMS, sendAppointmentReminder };
