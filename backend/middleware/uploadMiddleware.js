import multer from 'multer';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, callback) {
    if (!allowedTypes.has(file.mimetype)) {
      return callback(new Error('Choose a JPEG, PNG, or WebP image'));
    }
    callback(null, true);
  },
});

export const uploadProfilePhoto = (req, res, next) => {
  upload.single('photo')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ msg: 'Photo must be 5 MB or smaller' });
    }
    return res.status(400).json({ msg: error.message || 'Invalid photo upload' });
  });
};
