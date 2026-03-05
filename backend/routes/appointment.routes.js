const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/appointment.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize }    = require('../middleware/rbac.middleware');

router.use(authenticate);

router.post('/',                          authorize('patient'),         ctrl.book);
router.get('/patient',                    authorize('patient'),         ctrl.listPatientAppointments);
router.get('/doctor',                     authorize('doctor'),          ctrl.listDoctorAppointments);
router.get('/:id',                        authorize('patient', 'doctor', 'admin'), ctrl.getAppointment);
router.put('/:id/cancel',                 authorize('patient', 'doctor', 'admin'), ctrl.cancel);
router.put('/:id/confirm',                authorize('doctor'),          ctrl.confirm);
router.post('/:id/consultation/start',    authorize('doctor'),          ctrl.startConsultation);

module.exports = router;
