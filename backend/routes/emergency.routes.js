const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/emergency.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize }    = require('../middleware/rbac.middleware');

router.use(authenticate);

// Patient routes
router.post('/sos',           authorize('patient'), ctrl.triggerSOS);
router.get('/contacts',       authorize('patient'), ctrl.listContacts);
router.post('/contacts',      authorize('patient'), ctrl.addContact);
router.put('/contacts/:id',   authorize('patient'), ctrl.updateContact);
router.delete('/contacts/:id', authorize('patient'), ctrl.deleteContact);
router.get('/sos/history',    authorize('patient'), ctrl.getSOSHistory);

// Doctor/Admin routes
router.get('/sos/active',      authorize('doctor', 'admin'), ctrl.getActiveEmergencies);
router.patch('/sos/:id/respond', authorize('doctor', 'admin'), ctrl.respondToSOS);

module.exports = router;
