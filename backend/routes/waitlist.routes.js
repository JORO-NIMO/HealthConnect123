const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/waitlist.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize }    = require('../middleware/rbac.middleware');

router.use(authenticate);

// Patient routes
router.post('/',            authorize('patient'),         ctrl.join);
router.get('/mine',         authorize('patient'),         ctrl.myWaitlist);
router.put('/:id/cancel',   authorize('patient'),         ctrl.cancel);

// Doctor routes
router.get('/doctor',       authorize('doctor'),          ctrl.doctorViewWaitlist);

// Shared
router.get('/count',        authorize('patient', 'doctor'), ctrl.getCount);

module.exports = router;
