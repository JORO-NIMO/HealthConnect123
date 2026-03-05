const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/doctor.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize }    = require('../middleware/rbac.middleware');

// Public routes
router.get('/',              ctrl.listDoctors);
router.get('/search',        ctrl.searchDoctors);
router.get('/:id',           ctrl.getPublicProfile);
router.get('/:id/availability', ctrl.getAvailability);

// Recommendation (needs auth for patient context)
router.post('/recommend',    authenticate, ctrl.recommend);

// Protected — doctor only
router.use(authenticate);

router.get('/me/profile',       authorize('doctor', 'admin'), ctrl.getProfile);
router.put('/me/profile',       authorize('doctor', 'admin'), ctrl.updateProfile);
router.get('/me/availability',  authorize('doctor', 'admin'), ctrl.getAvailability);
router.put('/me/availability',  authorize('doctor'),          ctrl.setAvailability);
router.get('/me/prescriptions', authorize('doctor', 'admin'), ctrl.getPrescriptions);

module.exports = router;
