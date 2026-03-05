const nodemailer = require('nodemailer');
const logger     = require('../utils/logger.util');

// ─── Transporter ──────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host  : process.env.EMAIL_HOST || 'smtp.sendgrid.net',
  port  : parseInt(process.env.EMAIL_PORT || '587'),
  secure: false,
  auth  : {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const FROM = `"${process.env.EMAIL_FROM_NAME || 'HealthConnect'}" <${process.env.EMAIL_FROM || 'noreply@healthconnect.health'}>`;

// ─── Base send ────────────────────────────────────────────────────────────
async function sendEmail({ to, subject, html, text }) {
  try {
    const info = await transporter.sendMail({ from: FROM, to, subject, html, text });
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (err) {
    logger.error(`Email send failed to ${to}:`, err.message);
    throw err;
  }
}

// ─── Templates ────────────────────────────────────────────────────────────
async function sendVerificationEmail(user) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <div style="background:#0EA5E9;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
        <h1 style="color:white;margin:0;">🏥 HealthConnect</h1>
      </div>
      <div style="background:#f8fafc;padding:30px;border-radius:0 0 8px 8px;">
        <h2>Welcome, ${user.first_name}!</h2>
        <p>Thank you for registering with HealthConnect. Your account has been created successfully.</p>
        <p>You can now:</p>
        <ul>
          <li>Check your symptoms with our AI assistant</li>
          <li>Book consultations with verified doctors</li>
          <li>Access your complete medical history</li>
        </ul>
        <p style="margin-top:30px;font-size:12px;color:#64748b;">
          If you have any questions, contact us at support@healthconnect.health
        </p>
      </div>
    </div>
  `;
  return sendEmail({ to: user.email, subject: 'Welcome to HealthConnect! 🏥', html });
}

async function sendAppointmentConfirmation(appointment) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <div style="background:#0EA5E9;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
        <h1 style="color:white;margin:0;">🏥 Appointment Confirmation</h1>
      </div>
      <div style="background:#f8fafc;padding:30px;border-radius:0 0 8px 8px;">
        <h2>Appointment Booked!</h2>
        <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:15px 0;">
          <p><strong>📅 Date:</strong> ${appointment.appointment_date}</p>
          <p><strong>🕐 Time:</strong> ${appointment.appointment_time}</p>
          <p><strong>👨‍⚕️ Doctor:</strong> Dr. ${appointment.doctor_first_name} ${appointment.doctor_last_name}</p>
          <p><strong>🩺 Specialization:</strong> ${appointment.specialization}</p>
          <p><strong>📹 Type:</strong> ${appointment.type}</p>
        </div>
        <p>You will receive a reminder 1 hour before your appointment.</p>
      </div>
    </div>
  `;
  return sendEmail({
    to     : appointment.patient_email,
    subject: `Appointment Confirmed — ${appointment.appointment_date} at ${appointment.appointment_time}`,
    html,
  });
}

async function sendPasswordResetEmail(user, resetToken) {
  const resetUrl = `${process.env.FRONTEND_URL}/pages/auth/reset-password.html?token=${resetToken}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <h2>Password Reset Request</h2>
      <p>Hi ${user.first_name},</p>
      <p>We received a request to reset your password.</p>
      <a href="${resetUrl}" style="background:#0EA5E9;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:15px 0;">
        Reset Password
      </a>
      <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
    </div>
  `;
  return sendEmail({ to: user.email, subject: 'Reset Your HealthConnect Password', html });
}

module.exports = { sendEmail, sendVerificationEmail, sendAppointmentConfirmation, sendPasswordResetEmail };
