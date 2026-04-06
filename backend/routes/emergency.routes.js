const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/emergency.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize }    = require('../middleware/rbac.middleware');
const { validateSOS }  = require('../middleware/validation.middleware');

router.use(authenticate);

// Patient routes
router.post('/sos',           authorize('patient'), validateSOS, ctrl.triggerSOS);
router.get('/contacts',       authorize('patient'), ctrl.listContacts);
router.post('/contacts',      authorize('patient'), ctrl.addContact);
router.put('/contacts/:id',   authorize('patient'), ctrl.updateContact);
router.delete('/contacts/:id', authorize('patient'), ctrl.deleteContact);
router.get('/sos/history',    authorize('patient'), ctrl.getSOSHistory);

// Doctor/Admin routes
router.get('/sos/active',      authorize('doctor', 'admin', 'hospital_admin'), ctrl.getActiveEmergencies);
router.patch('/sos/:id/respond', authorize('doctor', 'admin', 'hospital_admin'), ctrl.respondToSOS);
router.get('/sos/hospital/queue', authorize('hospital_admin', 'doctor', 'admin'), ctrl.getHospitalSOSQueue);

module.exports = router;
