const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/doctor.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize }    = require('../middleware/rbac.middleware');

// Public routes (no wildcards that shadow /me routes)
router.get('/',              ctrl.listDoctors);
router.get('/search',        ctrl.searchDoctors);
router.get('/nearby',        ctrl.nearbyDoctors);

// Recommendation (needs auth for patient context)
router.post('/recommend',    authenticate, ctrl.recommend);

// Protected — doctor only (MUST be before /:id wildcard)
router.get('/me/profile',       authenticate, authorize('doctor', 'admin'), ctrl.getProfile);
router.put('/me/profile',       authenticate, authorize('doctor', 'admin'), ctrl.updateProfile);
router.get('/me/availability',  authenticate, authorize('doctor', 'admin'), ctrl.getAvailability);
router.put('/me/availability',  authenticate, authorize('doctor'),          ctrl.setAvailability);
router.get('/me/prescriptions', authenticate, authorize('doctor', 'admin'), ctrl.getPrescriptions);

// Public wildcard routes (AFTER /me/* routes to avoid shadowing)
router.get('/:id',              ctrl.getPublicProfile);
router.get('/:id/availability', ctrl.getAvailability);

module.exports = router;
