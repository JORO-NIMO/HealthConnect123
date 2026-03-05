const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/patient.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize }    = require('../middleware/rbac.middleware');
const { uploadAvatar } = require('../middleware/upload.middleware');

router.use(authenticate);
router.use(authorize('patient', 'admin'));

router.get('/profile',         ctrl.getProfile);
router.put('/profile',         ctrl.updateProfile);
router.post('/avatar', (req, res, next) => {
  uploadAvatar(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
}, ctrl.uploadAvatar);
router.get('/medical-history', ctrl.getMedicalHistory);
router.get('/prescriptions',   ctrl.getPrescriptions);
router.get('/payments',        ctrl.getPayments);
router.get('/stats',           ctrl.getDashboardStats);

module.exports = router;
