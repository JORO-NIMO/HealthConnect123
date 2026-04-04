/**
 * HealthConnect — Multer upload middleware
 * Handles avatar image uploads (JPG, PNG, WebP — max 3 MB)
 */

const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// Ensure upload directory exists
const AVATAR_DIR = path.join(__dirname, '../../frontend/uploads/avatars');
if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });

const DOCTOR_VERIFICATION_DIR = path.join(__dirname, '../../frontend/uploads/doctor-verification');
if (!fs.existsSync(DOCTOR_VERIFICATION_DIR)) fs.mkdirSync(DOCTOR_VERIFICATION_DIR, { recursive: true });

const TEST_RESULT_DIR = path.join(__dirname, '../../frontend/uploads/test-results');
if (!fs.existsSync(TEST_RESULT_DIR)) fs.mkdirSync(TEST_RESULT_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase() || '.jpg';
    const name = `avatar-${req.user.id}-${Date.now()}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only JPEG, PNG, WebP or GIF images are allowed'), false);
};

const uploadAvatar = multer({
  storage,
  fileFilter,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB
}).single('avatar');

const doctorVerificationStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, DOCTOR_VERIFICATION_DIR),
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase() || '.pdf';
    const name = `doctor-verification-${req.user.id}-${Date.now()}${ext}`;
    cb(null, name);
  },
});

const doctorVerificationFilter = (_req, file, cb) => {
  const allowed = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  if (allowed.includes(file.mimetype) || file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('Unsupported file type. Allowed: PDF, images, Word documents.'), false);
};

const uploadDoctorVerificationDocument = multer({
  storage: doctorVerificationStorage,
  fileFilter: doctorVerificationFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
}).single('file');

const testResultStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, TEST_RESULT_DIR),
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase() || '.bin';
    const name = `test-result-${req.user.id}-${Date.now()}${ext}`;
    cb(null, name);
  },
});

const testResultFileFilter = (_req, file, cb) => {
  const allowed = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  if (allowed.includes(file.mimetype) || file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('Unsupported file type. Allowed: images, PDF, Word documents.'), false);
};

const uploadTestResultAttachment = multer({
  storage: testResultStorage,
  fileFilter: testResultFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
}).single('file');

module.exports = { uploadAvatar, uploadDoctorVerificationDocument, uploadTestResultAttachment };
