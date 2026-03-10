const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const { v4: uuidv4 } = require('uuid');
const ctrl     = require('../controllers/documents.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize }    = require('../middleware/rbac.middleware');

// ── Ensure upload directory exists ─────────────────────────────────────
const uploadDir = path.join(__dirname, '../../frontend/uploads/documents');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ── Multer config for medical documents ────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `doc-${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/dicom', 'application/dicom',
    ];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Allowed: PDF, images, Word documents.'));
    }
  },
});

router.use(authenticate);

// Patient routes
router.post('/',       authorize('patient'), upload.single('file'), ctrl.uploadDocument);
router.get('/',        authorize('patient'), ctrl.listDocuments);

// Doctor/admin routes (MUST come before /:id to avoid shadowing)
router.get('/patient/:patientId', authorize('doctor', 'admin'), ctrl.getPatientDocuments);

// Wildcard routes (after named routes)
router.get('/:id',     authorize('patient', 'doctor', 'admin'), ctrl.getDocument);
router.put('/:id',     authorize('patient'), ctrl.updateDocument);
router.delete('/:id',  authorize('patient'), ctrl.deleteDocument);

module.exports = router;
