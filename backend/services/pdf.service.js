const PDFDocument = require('pdfkit');
const logger      = require('../utils/logger.util');

/**
 * HealthConnect — PDF Generation Service
 * Generates professional prescription PDFs and medical reports.
 */

function generatePrescriptionPDF(prescription, stream) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 60, right: 60 },
        info: {
          Title: `Prescription - ${prescription.diagnosis}`,
          Author: `Dr. ${prescription.doctor_first_name} ${prescription.doctor_last_name}`,
          Subject: 'Medical Prescription',
          Creator: 'HealthConnect',
        },
      });

      doc.pipe(stream);

      // ── Header ──────────────────────────────────────────────────────
      doc.rect(0, 0, doc.page.width, 120).fill('#0E7490');

      doc.fontSize(24).fill('#FFFFFF').font('Helvetica-Bold')
         .text('HealthConnect', 60, 35);
      doc.fontSize(10).fill('#B2EBF2').font('Helvetica')
         .text('AI-Powered Healthcare Platform', 60, 65);
      doc.fontSize(9).fill('#B2EBF2')
         .text(`Prescription #${prescription.id?.slice(0, 8).toUpperCase()}`, 60, 82);

      // Date on the right
      doc.fontSize(10).fill('#FFFFFF').font('Helvetica')
         .text(new Date(prescription.created_at).toLocaleDateString('en-GB', {
           day: 'numeric', month: 'long', year: 'numeric',
         }), 350, 50, { align: 'right' });

      // ── Rx Symbol ───────────────────────────────────────────────────
      doc.fontSize(48).fill('#0E7490').font('Helvetica-Bold')
         .text('℞', 60, 140);

      // ── Doctor Info ─────────────────────────────────────────────────
      const doctorY = 145;
      doc.fontSize(14).fill('#1A202C').font('Helvetica-Bold')
         .text(`Dr. ${prescription.doctor_first_name} ${prescription.doctor_last_name}`, 110, doctorY);
      doc.fontSize(10).fill('#4A5568').font('Helvetica')
         .text(prescription.specialization || 'General Practitioner', 110, doctorY + 20);
      if (prescription.license_number) {
        doc.text(`License: ${prescription.license_number}`, 110, doctorY + 35);
      }

      // ── Divider ─────────────────────────────────────────────────────
      doc.moveTo(60, 200).lineTo(doc.page.width - 60, 200)
         .strokeColor('#E2E8F0').lineWidth(1).stroke();

      // ── Patient Info ────────────────────────────────────────────────
      const patY = 215;
      doc.fontSize(11).fill('#718096').font('Helvetica')
         .text('PATIENT', 60, patY);
      doc.fontSize(13).fill('#1A202C').font('Helvetica-Bold')
         .text(`${prescription.patient_first_name} ${prescription.patient_last_name}`, 60, patY + 18);

      doc.fontSize(11).fill('#718096').font('Helvetica')
         .text('DATE', 350, patY);
      doc.fontSize(12).fill('#1A202C').font('Helvetica')
         .text(new Date(prescription.created_at).toLocaleDateString('en-GB'), 350, patY + 18);

      // ── Diagnosis ───────────────────────────────────────────────────
      doc.moveTo(60, 260).lineTo(doc.page.width - 60, 260)
         .strokeColor('#E2E8F0').lineWidth(1).stroke();

      doc.fontSize(11).fill('#718096').font('Helvetica')
         .text('DIAGNOSIS', 60, 272);
      doc.fontSize(12).fill('#1A202C').font('Helvetica-Bold')
         .text(prescription.diagnosis || 'Not specified', 60, 290);

      // ── Medications ─────────────────────────────────────────────────
      doc.moveTo(60, 320).lineTo(doc.page.width - 60, 320)
         .strokeColor('#E2E8F0').lineWidth(1).stroke();

      doc.fontSize(12).fill('#0E7490').font('Helvetica-Bold')
         .text('PRESCRIBED MEDICATIONS', 60, 335);

      let y = 360;
      const meds = prescription.medications || [];

      meds.forEach((med, i) => {
        // Check if we need a new page
        if (y > 700) {
          doc.addPage();
          y = 60;
        }

        // Medication card background
        doc.roundedRect(60, y, doc.page.width - 120, 70, 6)
           .fillAndStroke('#F7FAFC', '#E2E8F0');

        // Number badge
        doc.circle(82, y + 16, 12).fill('#0E7490');
        doc.fontSize(10).fill('#FFFFFF').font('Helvetica-Bold')
           .text(`${i + 1}`, 76, y + 10);

        // Medication name
        doc.fontSize(13).fill('#1A202C').font('Helvetica-Bold')
           .text(med.medication_name || med.name, 100, y + 8);

        // Details row
        doc.fontSize(10).fill('#4A5568').font('Helvetica');
        const details = [];
        if (med.dosage)    details.push(`Dosage: ${med.dosage}`);
        if (med.frequency) details.push(`Frequency: ${med.frequency}`);
        if (med.duration)  details.push(`Duration: ${med.duration}`);
        doc.text(details.join('  •  '), 100, y + 28);

        // Instructions
        if (med.instructions) {
          doc.fontSize(9).fill('#718096').font('Helvetica-Oblique')
             .text(`Instructions: ${med.instructions}`, 100, y + 45, { width: 380 });
        }

        y += 80;
      });

      // ── Notes ───────────────────────────────────────────────────────
      if (prescription.notes) {
        y += 10;
        if (y > 680) { doc.addPage(); y = 60; }

        doc.fontSize(11).fill('#718096').font('Helvetica')
           .text('ADDITIONAL NOTES', 60, y);
        doc.fontSize(11).fill('#1A202C').font('Helvetica')
           .text(prescription.notes, 60, y + 18, { width: doc.page.width - 120 });
        y += 50;
      }

      // ── Validity ────────────────────────────────────────────────────
      if (prescription.valid_until) {
        y += 10;
        if (y > 700) { doc.addPage(); y = 60; }
        doc.fontSize(10).fill('#E53E3E').font('Helvetica-Bold')
           .text(`Valid until: ${new Date(prescription.valid_until).toLocaleDateString('en-GB')}`, 60, y);
      }

      // ── Footer ──────────────────────────────────────────────────────
      const footerY = doc.page.height - 80;
      doc.moveTo(60, footerY).lineTo(doc.page.width - 60, footerY)
         .strokeColor('#E2E8F0').lineWidth(0.5).stroke();

      doc.fontSize(8).fill('#A0AEC0').font('Helvetica')
         .text('This prescription was generated by HealthConnect. Verify authenticity with your healthcare provider.', 60, footerY + 10, { align: 'center', width: doc.page.width - 120 })
         .text('© HealthConnect — AI-Powered Healthcare Platform', 60, footerY + 25, { align: 'center', width: doc.page.width - 120 });

      doc.end();

      stream.on('finish', resolve);
      stream.on('error', reject);
    } catch (err) {
      logger.error('PDF generation error:', err);
      reject(err);
    }
  });
}

/**
 * Generate a vital signs report PDF
 */
function generateVitalsReportPDF(patient, vitals, averages, stream) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 60, right: 60 } });
      doc.pipe(stream);

      // Header
      doc.rect(0, 0, doc.page.width, 100).fill('#0E7490');
      doc.fontSize(22).fill('#FFFFFF').font('Helvetica-Bold')
         .text('HealthConnect — Vital Signs Report', 60, 30);
      doc.fontSize(11).fill('#B2EBF2').font('Helvetica')
         .text(`Patient: ${patient.first_name} ${patient.last_name} | Generated: ${new Date().toLocaleDateString('en-GB')}`, 60, 60);

      // Averages Summary
      let y = 120;
      doc.fontSize(14).fill('#0E7490').font('Helvetica-Bold')
         .text('Summary (Last 30 Days)', 60, y);
      y += 25;

      if (averages) {
        const summaryItems = [
          { label: 'Avg Blood Pressure', value: `${averages.avg_systolic || '—'}/${averages.avg_diastolic || '—'} mmHg` },
          { label: 'Avg Heart Rate', value: `${averages.avg_heart_rate || '—'} bpm` },
          { label: 'Avg Temperature', value: `${averages.avg_temperature || '—'} °C` },
          { label: 'Avg Blood Sugar', value: `${averages.avg_blood_sugar || '—'} mg/dL` },
          { label: 'Total Readings', value: `${averages.total_readings || 0}` },
        ];

        summaryItems.forEach(item => {
          doc.fontSize(10).fill('#4A5568').font('Helvetica')
             .text(`${item.label}:`, 60, y);
          doc.fontSize(10).fill('#1A202C').font('Helvetica-Bold')
             .text(item.value, 200, y);
          y += 18;
        });
      }

      // Recent Readings Table
      y += 20;
      doc.fontSize(14).fill('#0E7490').font('Helvetica-Bold')
         .text('Recent Readings', 60, y);
      y += 25;

      // Table header
      doc.fontSize(8).fill('#718096').font('Helvetica-Bold');
      const cols = [60, 130, 180, 220, 260, 300, 345, 400];
      const headers = ['Date', 'BP', 'HR', 'Temp', 'SpO2', 'Sugar', 'Weight', 'Notes'];
      headers.forEach((h, i) => doc.text(h, cols[i], y));
      y += 15;

      doc.moveTo(60, y).lineTo(doc.page.width - 60, y).strokeColor('#E2E8F0').stroke();
      y += 5;

      // Table rows
      doc.fontSize(8).fill('#1A202C').font('Helvetica');
      for (const v of vitals.slice(0, 30)) {
        if (y > 720) { doc.addPage(); y = 60; }

        doc.text(new Date(v.recorded_at).toLocaleDateString('en-GB'), cols[0], y);
        doc.text(v.systolic_bp ? `${v.systolic_bp}/${v.diastolic_bp}` : '—', cols[1], y);
        doc.text(v.heart_rate ? `${v.heart_rate}` : '—', cols[2], y);
        doc.text(v.temperature ? `${v.temperature}°` : '—', cols[3], y);
        doc.text(v.oxygen_sat ? `${v.oxygen_sat}%` : '—', cols[4], y);
        doc.text(v.blood_sugar ? `${v.blood_sugar}` : '—', cols[5], y);
        doc.text(v.weight_kg ? `${v.weight_kg}kg` : '—', cols[6], y);
        doc.text(v.notes ? v.notes.slice(0, 15) : '—', cols[7], y);
        y += 14;
      }

      doc.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generatePrescriptionPDF, generateVitalsReportPDF };
