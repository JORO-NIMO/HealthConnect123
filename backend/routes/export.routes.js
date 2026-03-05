const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const path    = require('path');
const PrescriptionModel = require('../models/Prescription.model');
const PatientModel      = require('../models/Patient.model');
const VitalSignModel    = require('../models/VitalSign.model');
const { generatePrescriptionPDF, generateVitalsReportPDF } = require('../services/pdf.service');
const { authenticate }  = require('../middleware/auth.middleware');
const { authorize }     = require('../middleware/rbac.middleware');

router.use(authenticate);

// ─── Download Prescription PDF ──────────────────────────────────────────
router.get('/prescription/:id', authorize('patient', 'doctor', 'admin'), async (req, res, next) => {
  try {
    const prescription = await PrescriptionModel.findById(req.params.id);
    if (!prescription) return res.status(404).json({ success: false, message: 'Prescription not found.' });

    // Verify access
    if (req.user.role === 'patient') {
      const patient = await PatientModel.findByUserId(req.user.id);
      if (prescription.patient_id !== patient?.id) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    const fileName = `prescription-${prescription.id.slice(0, 8)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await generatePrescriptionPDF(prescription, res);
  } catch (err) { next(err); }
});

// ─── Download Vitals Report PDF ─────────────────────────────────────────
router.get('/vitals-report', authorize('patient'), async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found.' });

    const [vitals, averages] = await Promise.all([
      VitalSignModel.listByPatient(patient.id, { limit: 50 }),
      VitalSignModel.getAverages(patient.id, 30),
    ]);

    const fileName = `vitals-report-${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await generateVitalsReportPDF(
      { first_name: req.user.first_name, last_name: req.user.last_name },
      vitals, averages, res
    );
  } catch (err) { next(err); }
});

module.exports = router;
