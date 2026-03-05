const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/symptom.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize }    = require('../middleware/rbac.middleware');
const { aiLimiter }    = require('../middleware/rateLimiter.middleware');

// Public
router.get('/list', ctrl.getSymptomList);

// Protected — patients
router.use(authenticate);
router.post('/analyze',  aiLimiter, authorize('patient'), ctrl.analyzeSymptoms);
router.post('/follow-up', authorize('patient'), ctrl.getFollowUp);
router.get('/history',    authorize('patient'), ctrl.getHistory);
router.get('/report/:id', authorize('patient', 'doctor', 'admin'), ctrl.getReport);

module.exports = router;
