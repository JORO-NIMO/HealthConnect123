const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/doctor.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize }    = require('../middleware/rbac.middleware');
const { uploadDoctorVerificationDocument } = require('../middleware/upload.middleware');

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
router.get('/me/verification-documents', authenticate, authorize('doctor', 'admin'), ctrl.listVerificationDocuments);
router.post('/me/verification-documents', authenticate, authorize('doctor'), (req, res, next) => {
	uploadDoctorVerificationDocument(req, res, (err) => {
		if (err) return res.status(400).json({ success: false, message: err.message });
		next();
	});
}, ctrl.uploadVerificationDocument);
router.delete('/me/verification-documents/:docId', authenticate, authorize('doctor'), ctrl.deleteVerificationDocument);

// Public wildcard routes (AFTER /me/* routes to avoid shadowing)
router.get('/:id',              ctrl.getPublicProfile);
router.get('/:id/availability', ctrl.getAvailability);

module.exports = router;
