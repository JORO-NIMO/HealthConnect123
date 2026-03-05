const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/review.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize }    = require('../middleware/rbac.middleware');

// Public — view doctor reviews
router.get('/doctor/:doctorId', ctrl.getDoctorReviews);

// Protected — patient actions
router.use(authenticate);
router.post('/',       authorize('patient'), ctrl.submitReview);
router.put('/:id',     authorize('patient'), ctrl.updateReview);
router.delete('/:id',  authorize('patient'), ctrl.deleteReview);

module.exports = router;
