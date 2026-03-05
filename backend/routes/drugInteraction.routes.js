const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/drugInteraction.controller');
const { authenticate }  = require('../middleware/auth.middleware');
const { authorize }     = require('../middleware/rbac.middleware');
const { aiLimiter }     = require('../middleware/rateLimiter.middleware');

router.use(authenticate);

router.post('/check',   aiLimiter, authorize('patient', 'doctor'), ctrl.checkInteractions);
router.get('/history',  authorize('patient'), ctrl.getHistory);

module.exports = router;
