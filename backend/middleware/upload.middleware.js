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

module.exports = { uploadAvatar };
