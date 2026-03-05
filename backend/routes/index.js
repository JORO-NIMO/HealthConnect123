const express = require('express');
const router  = express.Router();

router.use('/auth',              require('./auth.routes'));
router.use('/patients',          require('./patient.routes'));
router.use('/doctors',           require('./doctor.routes'));
router.use('/symptoms',          require('./symptom.routes'));
router.use('/appointments',      require('./appointment.routes'));
router.use('/consultations',     require('./consultation.routes'));
router.use('/admin',             require('./admin.routes'));

// ── New Feature Routes ──────────────────────────────────────────────────
router.use('/vitals',            require('./vitals.routes'));
router.use('/documents',         require('./documents.routes'));
router.use('/notifications',     require('./notifications.routes'));
router.use('/emergency',         require('./emergency.routes'));
router.use('/reviews',           require('./review.routes'));
router.use('/drug-interactions', require('./drugInteraction.routes'));
router.use('/export',            require('./export.routes'));
router.use('/health-records',    require('./healthRecords.routes'));
router.use('/waitlist',          require('./waitlist.routes'));
router.use('/payments',          require('./payment.routes'));

module.exports = router;
