const cron   = require('node-cron');
const { query } = require('../config/database');
const SMSService        = require('./sms.service');
const EmailService      = require('./email.service');
const NotificationModel = require('../models/Notification.model');
const logger            = require('../utils/logger.util');

/**
 * HealthConnect — Scheduled Background Jobs
 * Runs appointment reminders, prescription expiry, notification cleanup, etc.
 */
function initCronJobs() {
  logger.info('⏰ Initializing scheduled jobs...');

  // ─── 1. Appointment Reminders (every 30 minutes) ──────────────────────
  cron.schedule('*/30 * * * *', async () => {
    try {
      // Find appointments in next 2 hours that haven't been reminded
      const upcoming = await query(`
        SELECT a.*, u.first_name, u.last_name, u.phone, u.email,
               ud.first_name AS doctor_first_name, ud.last_name AS doctor_last_name,
               d.specialization, p.user_id AS patient_user_id
        FROM appointments a
        JOIN patients p ON p.id = a.patient_id
        JOIN users u ON u.id = p.user_id
        JOIN doctors d ON d.id = a.doctor_id
        JOIN users ud ON ud.id = d.user_id
        WHERE a.status = 'confirmed'
          AND a.appointment_date = CURDATE()
          AND a.appointment_time BETWEEN CURTIME() AND ADDTIME(CURTIME(), '02:00:00')
          AND a.id NOT IN (
            SELECT JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.appointmentId'))
            FROM notifications
            WHERE type = 'reminder'
              AND created_at > DATE_SUB(NOW(), INTERVAL 3 HOUR)
          )
      `);

      for (const appt of upcoming) {
        // In-app notification
        await NotificationModel.create({
          userId: appt.patient_user_id,
          title: '⏰ Appointment Reminder',
          message: `Your appointment with Dr. ${appt.doctor_first_name} ${appt.doctor_last_name} (${appt.specialization}) is at ${appt.appointment_time?.toString().slice(0, 5)} today.`,
          type: 'reminder',
          actionUrl: '/pages/patient/appointments.html',
          metadata: { appointmentId: appt.id },
        });

        // SMS reminder
        if (appt.phone) {
          SMSService.sendAppointmentReminder(appt.phone, {
            doctorName: `Dr. ${appt.doctor_first_name} ${appt.doctor_last_name}`,
            date: 'today',
            time: appt.appointment_time?.toString().slice(0, 5),
          }).catch(err => logger.error('Reminder SMS failed:', err.message));
        }
      }

      if (upcoming.length) logger.info(`📩 Sent ${upcoming.length} appointment reminders`);
    } catch (err) {
      logger.error('Appointment reminder cron error:', err.message);
    }
  });

  // ─── 2. Expire Old Prescriptions (daily at midnight) ──────────────────
  cron.schedule('0 0 * * *', async () => {
    try {
      const result = await query(
        `UPDATE prescriptions SET status = 'expired'
         WHERE status = 'active' AND valid_until IS NOT NULL AND valid_until < CURDATE()`
      );
      if (result.affectedRows) {
        logger.info(`💊 Expired ${result.affectedRows} prescriptions`);
      }
    } catch (err) {
      logger.error('Prescription expiry cron error:', err.message);
    }
  });

  // ─── 3. No-show Detection (every hour) ────────────────────────────────
  cron.schedule('0 * * * *', async () => {
    try {
      const result = await query(
        `UPDATE appointments SET status = 'no_show'
         WHERE status = 'confirmed'
           AND CONCAT(appointment_date, ' ', appointment_time) < DATE_SUB(NOW(), INTERVAL 1 HOUR)`
      );
      if (result.affectedRows) {
        logger.info(`👤 Marked ${result.affectedRows} appointments as no-show`);
      }
    } catch (err) {
      logger.error('No-show detection cron error:', err.message);
    }
  });

  // ─── 4. Clean Old Notifications (weekly on Sunday 3AM) ────────────────
  cron.schedule('0 3 * * 0', async () => {
    try {
      const deleted = await NotificationModel.deleteOlderThan(90);
      if (deleted) logger.info(`🗑️ Cleaned ${deleted} old notifications`);
    } catch (err) {
      logger.error('Notification cleanup cron error:', err.message);
    }
  });

  // ─── 5. Medication Reminder Check (every 15 minutes) ──────────────────
  cron.schedule('*/15 * * * *', async () => {
    try {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes() < 15 ? 0 : 15).padStart(2, '0')}`;

      const reminders = await query(`
        SELECT mr.*, p.user_id, u.first_name, u.phone
        FROM medication_reminders mr
        JOIN patients p ON p.id = mr.patient_id
        JOIN users u ON u.id = p.user_id
        WHERE mr.is_active = TRUE
          AND mr.start_date <= CURDATE()
          AND (mr.end_date IS NULL OR mr.end_date >= CURDATE())
          AND JSON_CONTAINS(mr.reminder_times, ?)
      `, [JSON.stringify(timeStr)]);

      for (const reminder of reminders) {
        await NotificationModel.create({
          userId: reminder.user_id,
          title: '💊 Medication Reminder',
          message: `Time to take ${reminder.medication_name} (${reminder.dosage})`,
          type: 'reminder',
          metadata: { reminderId: reminder.id, medication: reminder.medication_name },
        });
      }

      if (reminders.length) logger.info(`💊 Sent ${reminders.length} medication reminders`);
    } catch (err) {
      logger.error('Medication reminder cron error:', err.message);
    }
  });

  // ─── 6. Vital Sign Trend Alerts (daily at 9AM) ───────────────────────
  cron.schedule('0 9 * * *', async () => {
    try {
      // Find patients with consistently abnormal vitals in last 7 days
      const abnormal = await query(`
        SELECT patient_id, p.user_id,
               AVG(systolic_bp) AS avg_sys, AVG(diastolic_bp) AS avg_dia,
               AVG(blood_sugar) AS avg_sugar, COUNT(*) AS readings
        FROM vital_signs vs
        JOIN patients p ON p.id = vs.patient_id
        WHERE vs.recorded_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY patient_id
        HAVING (avg_sys > 140 OR avg_dia > 90 OR avg_sugar > 180) AND readings >= 3
      `);

      for (const patient of abnormal) {
        const warnings = [];
        if (patient.avg_sys > 140)    warnings.push(`Avg systolic BP: ${Math.round(patient.avg_sys)} mmHg`);
        if (patient.avg_dia > 90)     warnings.push(`Avg diastolic BP: ${Math.round(patient.avg_dia)} mmHg`);
        if (patient.avg_sugar > 180)  warnings.push(`Avg blood sugar: ${Math.round(patient.avg_sugar)} mg/dL`);

        await NotificationModel.create({
          userId: patient.user_id,
          title: '📊 Weekly Health Alert',
          message: `Your vitals over the past week show concerning trends:\n${warnings.join('\n')}\nPlease consult your doctor.`,
          type: 'vitals',
          actionUrl: '/pages/patient/vitals.html',
        });
      }

      if (abnormal.length) logger.info(`📊 Sent ${abnormal.length} weekly vital alerts`);
    } catch (err) {
      logger.error('Vital trend alert cron error:', err.message);
    }
  });

  logger.info('✅ All scheduled jobs initialized');
}

module.exports = { initCronJobs };
