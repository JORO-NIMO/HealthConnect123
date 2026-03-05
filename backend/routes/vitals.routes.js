const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/vitals.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize }    = require('../middleware/rbac.middleware');

router.use(authenticate);

// Patient routes
router.post('/',          authorize('patient'), ctrl.recordVitals);
router.get('/history',    authorize('patient'), ctrl.getHistory);
router.get('/latest',     authorize('patient'), ctrl.getLatest);
router.get('/trends',     authorize('patient'), ctrl.getTrends);
router.get('/averages',   authorize('patient'), ctrl.getAverages);
router.get('/alerts',     authorize('patient'), ctrl.getAlerts);
router.delete('/:id',     authorize('patient'), ctrl.deleteVital);

// Doctor routes — view patient vitals
router.get('/patient/:patientId', authorize('doctor', 'admin'), ctrl.getPatientVitals);

module.exports = router;
