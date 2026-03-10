const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/healthRecords.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize }    = require('../middleware/rbac.middleware');

router.use(authenticate);

// Patient routes (named paths first)
router.post('/',                    authorize('patient'),              ctrl.create);
router.get('/',                     authorize('patient'),              ctrl.list);
router.get('/timeline',             authorize('patient'),              ctrl.getTimeline);
router.get('/summary',              authorize('patient'),              ctrl.getSummary);
router.get('/access',               authorize('patient'),              ctrl.listAccessGrants);
router.post('/access/grant',        authorize('patient'),              ctrl.grantAccess);
router.post('/access/revoke',       authorize('patient'),              ctrl.revokeAccess);

// Doctor/admin routes (MUST come before /:id to avoid shadowing)
router.get('/patient/:patientId',   authorize('doctor', 'admin'),      ctrl.doctorViewPatientRecords);
router.post('/patient/:patientId',  authorize('doctor'),               ctrl.doctorAddRecord);

// Wildcard routes (after all named routes)
router.get('/:id',                  authorize('patient', 'doctor'),    ctrl.getRecord);
router.put('/:id',                  authorize('patient'),              ctrl.update);
router.delete('/:id',               authorize('patient'),              ctrl.deleteRecord);

module.exports = router;
