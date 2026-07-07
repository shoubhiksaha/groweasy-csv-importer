import multer from 'multer';

// Use memory storage to avoid disk writes
const storage = multer.memoryStorage();

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
    if (allowedMimes.includes(file.mimetype) || file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});
