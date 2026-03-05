const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/consultation.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize }    = require('../middleware/rbac.middleware');

router.use(authenticate);

router.get('/:id',                   authorize('patient', 'doctor', 'admin'), ctrl.getConsultation);
router.post('/:id/end',              authorize('doctor'),                     ctrl.end);
router.post('/:id/messages',         authorize('patient', 'doctor'),          ctrl.sendMessage);
router.get('/:id/messages',          authorize('patient', 'doctor', 'admin'), ctrl.getMessages);
router.post('/:id/prescriptions',    authorize('doctor'),                     ctrl.writePrescription);

module.exports = router;
