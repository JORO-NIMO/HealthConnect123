const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/admin.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize }    = require('../middleware/rbac.middleware');

router.use(authenticate, authorize('admin'));

router.get('/dashboard',         ctrl.getDashboard);
router.get('/users',             ctrl.listUsers);
router.delete('/users/:id',      ctrl.deactivateUser);
router.get('/doctors/pending',   ctrl.getPendingDoctors);
router.put('/doctors/:id/verify', ctrl.verifyDoctor);
router.get('/revenue',           ctrl.getRevenue);
router.get('/audit-logs',        ctrl.getAuditLogs);

module.exports = router;
