const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/payment.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize }    = require('../middleware/rbac.middleware');

// Stripe webhook (raw body needed — must be before authenticate)
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), ctrl.stripeWebhook);

// Authenticated routes
router.use(authenticate);
router.post('/create-intent',     authorize('patient'), ctrl.createPaymentIntent);
router.post('/momo',              authorize('patient'), ctrl.initiateMoMo);
router.get('/history',            authorize('patient'), ctrl.getHistory);
router.get('/appointment/:appointmentId', authorize('patient', 'doctor', 'admin'), ctrl.getPaymentForAppointment);

module.exports = router;
