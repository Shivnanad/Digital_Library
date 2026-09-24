const express = require('express');
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const router  = express.Router();
const adminCtrl = require('../controllers/adminController');
const { requireAuth, requireAdmin } = require('../middlewares/authMiddleware');

/* ── Multer: save cover images to /public/covers, PDFs to /public/pdfs ── */
const coversDir = path.join(__dirname, '..', 'public', 'covers');
const pdfsDir   = path.join(__dirname, '..', 'public', 'pdfs');
if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });
if (!fs.existsSync(pdfsDir))   fs.mkdirSync(pdfsDir,   { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'pdfFile') {
      cb(null, pdfsDir);
    } else {
      cb(null, coversDir);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const prefix = file.fieldname === 'pdfFile' ? 'book' : 'cover';
    cb(null, `${prefix}_${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB for PDFs
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'pdfFile') {
      if (file.mimetype === 'application/pdf') return cb(null, true);
      return cb(new Error('Only PDF files are allowed'));
    }
    // cover image
    const allowed = /jpeg|jpg|png|gif|webp/;
    if (allowed.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  }
});
const bookUpload = upload.fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'pdfFile',    maxCount: 1 }
]);

// Admin login (no auth required)
router.post('/login', adminCtrl.login);

// All admin endpoints require auth + admin role
router.get('/dashboard',              requireAuth, requireAdmin, adminCtrl.dashboard);
router.get('/users',                  requireAuth, requireAdmin, adminCtrl.listUsers);
router.put('/users/:id',              requireAuth, requireAdmin, adminCtrl.updateUser);
router.patch('/users/:id/enable',     requireAuth, requireAdmin, adminCtrl.setUserEnabled);
router.get('/books',                  requireAuth, requireAdmin, adminCtrl.listBooks);
router.post('/books',                 requireAuth, requireAdmin, bookUpload, adminCtrl.addBook);
router.put('/books/:id',              requireAuth, requireAdmin, bookUpload, adminCtrl.updateBook);
router.delete('/users/:id',           requireAuth, requireAdmin, adminCtrl.deleteUser);
router.delete('/books/:id',           requireAuth, requireAdmin, adminCtrl.deleteBook);
router.get('/categories',             requireAuth, requireAdmin, adminCtrl.listCategories);
router.get('/analytics/top-books',    requireAuth, requireAdmin, adminCtrl.analyticsTopBooks);
router.get('/analytics/logins',       requireAuth, requireAdmin, adminCtrl.analyticsLogins);
router.get('/analytics/searched',     requireAuth, requireAdmin, adminCtrl.analyticsSearched);
router.get('/analytics/refunds',      requireAuth, requireAdmin, adminCtrl.analyticsRefunds);
router.get('/refunds/requests',       requireAuth, requireAdmin, adminCtrl.listRefundRequests);
router.patch('/refunds/:orderId/items/:bookId/approve', requireAuth, requireAdmin, adminCtrl.approveRefundRequest);
router.patch('/refunds/:orderId/items/:bookId/reject',  requireAuth, requireAdmin, adminCtrl.rejectRefundRequest);

module.exports = router;
