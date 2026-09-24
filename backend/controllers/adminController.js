const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Book = require('../models/Book');
const Category = require('../models/Category');
const Order = require('../models/order');
const { sendCancellationEmail } = require('../utils/invoiceEmail');

function parseBooleanField(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return undefined;
}

const REFUND_METHODS = ['upi', 'debit', 'credit', 'netbanking', 'wallet'];

function computeOrderPaymentStatus(items = []) {
  const cancelledCount = items.filter((it) => it.status === 'cancelled').length;
  if (cancelledCount === 0) return 'paid';
  return cancelledCount === items.length ? 'refunded' : 'partially_refunded';
}

async function syncUserPurchasedBooks(userId) {
  const orders = await Order.find({ user: userId, paymentStatus: { $ne: 'failed' } })
    .select('items')
    .lean();

  const activeBookIds = new Set();
  orders.forEach((order) => {
    (order.items || []).forEach((item) => {
      if (item?.book && (!item.status || item.status === 'purchased' || item.status === 'cancel_requested' || item.status === 'cancel_rejected')) {
        activeBookIds.add(String(item.book));
      }
    });
  });

  const ids = Array.from(activeBookIds).map((id) => id);
  await User.updateOne({ _id: userId }, { $set: { purchasedBooks: ids } });
  return ids;
}

/* ── Admin Login ── */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
    }

    // Check if user is admin
    if (user.role !== 'admin') {
      return res.status(403).json({ status: 'error', message: 'Not authorized. Admin access only.' });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'secretkey',
      { expiresIn: '7d' }
    );

    res.json({ status: 'success', message: 'Login successful', token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Login failed', error: err.message });
  }
};

/* ── Dashboard ── */
exports.dashboard = async (req, res) => {
  try {
    const totalBooks = await Book.countDocuments();
    const totalUsers = await User.countDocuments();
    const totalOrders = await Order.countDocuments();
    const pendingRefundRequests = await Order.countDocuments({ 'items.status': 'cancel_requested' });
    // Sum of all user logins — we track the count of users with lastLogin set
    // and the most recent login timestamp so the admin panel can detect new logins
    const loggedInUsers = await User.find(
      { lastLogin: { $ne: null }, role: { $ne: 'admin' } },
      'lastLogin'
    ).sort({ lastLogin: -1 }).limit(1).lean();
    const lastLoginTime = loggedInUsers.length > 0 ? loggedInUsers[0].lastLogin : null;
    const totalLoggedIn = await User.countDocuments({ lastLogin: { $ne: null }, role: { $ne: 'admin' } });
    res.json({ totalBooks, totalUsers, totalOrders, pendingRefundRequests, totalLoggedIn, lastLoginTime });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.listRefundRequests = async (req, res) => {
  try {
    const orders = await Order.find({ 'items.status': 'cancel_requested' })
      .populate('user', 'name email')
      .sort({ updatedAt: -1 })
      .lean();

    const requests = [];
    orders.forEach((order) => {
      (order.items || []).forEach((item) => {
        if (item.status !== 'cancel_requested') return;
        requests.push({
          orderId: order._id,
          invoiceNumber: order.invoiceNumber,
          userId: order.user?._id,
          userName: order.user?.name || 'User',
          userEmail: order.user?.email || '',
          bookId: item.book,
          title: item.title,
          author: item.author,
          quantity: item.quantity || 1,
          price: item.price || 0,
          amount: (item.price || 0) * (item.quantity || 1),
          cancelReason: item.cancelReason || '',
          refundMethodRequested: item.refundMethodRequested || '',
          refundDetailsRequested: item.refundDetailsRequested || null,
          cancelRequestedAt: item.cancelRequestedAt || order.updatedAt,
        });
      });
    });

    res.json({ requests });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.approveRefundRequest = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).populate('user', 'name email');
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const item = (order.items || []).find((it) => String(it.book) === String(req.params.bookId));
    if (!item) return res.status(404).json({ message: 'Book item not found in order' });
    if (item.status !== 'cancel_requested') {
      return res.status(400).json({ message: 'No pending cancellation request for this item' });
    }

    const requested = String(item.refundMethodRequested || '').toLowerCase();
    const bodyMethod = String(req.body?.refundMethod || '').toLowerCase();
    const finalMethod = REFUND_METHODS.includes(bodyMethod)
      ? bodyMethod
      : (REFUND_METHODS.includes(requested) ? requested : 'upi');

    item.status = 'cancelled';
    item.cancelledAt = new Date();
    item.cancelReviewedAt = new Date();
    item.refundMethodApproved = finalMethod;
    item.cancelRejectReason = '';

    order.paymentStatus = computeOrderPaymentStatus(order.items || []);
    await order.save();

    await syncUserPurchasedBooks(order.user._id);

    const emailSent = await sendCancellationEmail({
      order,
      userEmail: order.user.email,
      userName: order.user.name,
      item,
      reason: item.cancelReason || 'Requested by user',
      refundMethod: finalMethod,
    });

    res.json({
      message: 'Refund request approved and cancellation completed',
      emailSent,
      paymentStatus: order.paymentStatus,
      approvedRefundMethod: finalMethod,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.rejectRefundRequest = async (req, res) => {
  try {
    const rejectReason = String(req.body?.reason || '').trim();
    if (!rejectReason || rejectReason.length < 3) {
      return res.status(400).json({ message: 'Please provide rejection reason' });
    }

    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const item = (order.items || []).find((it) => String(it.book) === String(req.params.bookId));
    if (!item) return res.status(404).json({ message: 'Book item not found in order' });
    if (item.status !== 'cancel_requested') {
      return res.status(400).json({ message: 'No pending cancellation request for this item' });
    }

    item.status = 'cancel_rejected';
    item.cancelReviewedAt = new Date();
    item.cancelRejectReason = rejectReason;

    await order.save();
    await syncUserPurchasedBooks(order.user);

    res.json({ message: 'Refund request rejected' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.analyticsRefunds = async (req, res) => {
  try {
    const pending = await Order.aggregate([
      { $unwind: '$items' },
      { $match: { 'items.status': 'cancel_requested' } },
      { $count: 'count' },
    ]);

    const approved = await Order.aggregate([
      { $unwind: '$items' },
      { $match: { 'items.status': 'cancelled' } },
      { $count: 'count' },
    ]);

    const rejected = await Order.aggregate([
      { $unwind: '$items' },
      { $match: { 'items.status': 'cancel_rejected' } },
      { $count: 'count' },
    ]);

    const byMethodRaw = await Order.aggregate([
      { $unwind: '$items' },
      { $match: { 'items.status': 'cancelled' } },
      {
        $group: {
          _id: '$items.refundMethodApproved',
          count: { $sum: 1 },
          amount: { $sum: { $multiply: [{ $ifNull: ['$items.price', 0] }, { $ifNull: ['$items.quantity', 1] }] } },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const trendDays = [];
    for (let i = 6; i >= 0; i--) {
      const from = new Date();
      from.setDate(from.getDate() - i);
      from.setHours(0, 0, 0, 0);
      const to = new Date();
      to.setDate(to.getDate() - i);
      to.setHours(23, 59, 59, 999);

      const row = await Order.aggregate([
        { $unwind: '$items' },
        {
          $match: {
            'items.status': 'cancelled',
            'items.cancelledAt': { $gte: from, $lte: to },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            amount: { $sum: { $multiply: [{ $ifNull: ['$items.price', 0] }, { $ifNull: ['$items.quantity', 1] }] } },
          },
        },
      ]);

      trendDays.push({
        date: from.toLocaleDateString('en-US', { weekday: 'short' }),
        count: row[0]?.count || 0,
        amount: +(row[0]?.amount || 0).toFixed(2),
      });
    }

    res.json({
      summary: {
        pending: pending[0]?.count || 0,
        approved: approved[0]?.count || 0,
        rejected: rejected[0]?.count || 0,
      },
      byMethod: byMethodRaw.map((row) => ({
        method: row._id || 'unknown',
        count: row.count || 0,
        amount: +(row.amount || 0).toFixed(2),
      })),
      trendDays,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── Users ── */
exports.listUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { name, email, role } = req.body;
    const updates = {};

    if (typeof name === 'string') updates.name = name.trim();
    if (typeof email === 'string') updates.email = email.trim().toLowerCase();
    if (typeof role === 'string') {
      const normalizedRole = role.trim().toLowerCase();
      if (!['admin', 'user'].includes(normalizedRole)) {
        return res.status(400).json({ message: 'Role must be admin or user' });
      }
      updates.role = normalizedRole;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User updated', user: updatedUser });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Email already exists' });
    }
    res.status(500).json({ message: err.message });
  }
};

exports.setUserEnabled = async (req, res) => {
  try {
    const enabled = Boolean(req.body?.enabled);
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { enabled } },
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: `User ${enabled ? 'enabled' : 'disabled'}`, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── Books ── */
exports.listBooks = async (req, res) => {
  try {
    const books = await Book.find().populate('category').lean();

    const purchaseAgg = await Order.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.book',
          purchaseCount: { $sum: { $ifNull: ['$items.quantity', 1] } }
        }
      }
    ]);

    const purchaseMap = new Map(
      purchaseAgg
        .filter(row => row && row._id)
        .map(row => [String(row._id), Number(row.purchaseCount || 0)])
    );

    const enriched = books.map(book => ({
      ...book,
      purchaseCount: purchaseMap.get(String(book._id)) || 0
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteBook = async (req, res) => {
  try {
    const book = await Book.findByIdAndDelete(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found' });
    res.json({ message: 'Book deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.addBook = async (req, res) => {
  try {
    const { title, author, category, price, description, language, pages, publishYear } = req.body;
    const parsedInStock = parseBooleanField(req.body?.inStock);

    // pdfUrl: from uploaded file, or from body text fallback
    let pdfUrl = req.body.pdfUrl || '';
    if (req.files && req.files.pdfFile && req.files.pdfFile[0]) {
      pdfUrl = `/pdfs/${req.files.pdfFile[0].filename}`;
    }

    if (!title || !author || !category || !pdfUrl) {
      return res.status(400).json({ message: 'title, author, category and PDF file are required' });
    }

    // Build coverUrl: if a file was uploaded serve it from /covers, else use provided URL string
    let coverUrl = req.body.coverUrl || '';
    if (req.files && req.files.coverImage && req.files.coverImage[0]) {
      coverUrl = `/covers/${req.files.coverImage[0].filename}`;
    }

    const book = await Book.create({
      title, author, category,
      price: price ? Number(price) : 0,
      description: description || '',
      language: language || '',
      pages: pages ? Number(pages) : undefined,
      publishYear: publishYear ? Number(publishYear) : undefined,
      pdfUrl,
      coverUrl,
      inStock: parsedInStock === undefined ? true : parsedInStock,
    });

    const populated = await book.populate('category');
    res.status(201).json({ message: 'Book added successfully', book: populated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found' });

    const {
      title,
      author,
      category,
      price,
      description,
      language,
      pages,
      publishYear,
      coverUrl,
      pdfUrl,
      inStock
    } = req.body;

    const updates = {};

    if (typeof title === 'string' && title.trim()) updates.title = title.trim();
    if (typeof author === 'string' && author.trim()) updates.author = author.trim();

    if (typeof category === 'string' && category.trim()) {
      const categoryExists = await Category.findById(category.trim());
      if (!categoryExists) {
        return res.status(404).json({ message: 'Category not found' });
      }
      updates.category = category.trim();
    }

    if (price !== undefined) {
      const n = Number(price);
      if (!Number.isNaN(n)) updates.price = n;
    }

    if (typeof description === 'string') updates.description = description.trim();
    if (typeof language === 'string') updates.language = language.trim();

    if (pages !== undefined) {
      const n = Number(pages);
      updates.pages = Number.isNaN(n) ? undefined : n;
    }

    if (publishYear !== undefined) {
      const n = Number(publishYear);
      updates.publishYear = Number.isNaN(n) ? undefined : n;
    }

    const parsedInStock = parseBooleanField(inStock);
    if (parsedInStock !== undefined) updates.inStock = parsedInStock;

    if (req.files && req.files.coverImage && req.files.coverImage[0]) {
      updates.coverUrl = `/covers/${req.files.coverImage[0].filename}`;
    } else if (typeof coverUrl === 'string' && coverUrl.trim()) {
      updates.coverUrl = coverUrl.trim();
    }

    if (req.files && req.files.pdfFile && req.files.pdfFile[0]) {
      updates.pdfUrl = `/pdfs/${req.files.pdfFile[0].filename}`;
    } else if (typeof pdfUrl === 'string' && pdfUrl.trim()) {
      updates.pdfUrl = pdfUrl.trim();
    }

    const updatedBook = await Book.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('category');

    res.json({ message: 'Book updated successfully', book: updatedBook });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── Analytics ── */
exports.analyticsTopBooks = async (req, res) => {
  try {
    // Top 10 books by views (proxy for most purchased/popular)
    const books = await Book.find().sort({ views: -1 }).limit(10).select('title author views');
    res.json(books);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.analyticsLogins = async (req, res) => {
  try {
    // Return new user registrations per day for the last 7 days as login proxy
    const days = 7;
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const from = new Date(); from.setDate(from.getDate() - i); from.setHours(0,0,0,0);
      const to   = new Date(); to.setDate(to.getDate() - i);   to.setHours(23,59,59,999);
      const count = await User.countDocuments({ createdAt: { $gte: from, $lte: to } });
      result.push({ date: from.toLocaleDateString('en-US',{weekday:'short', month:'short', day:'numeric'}), count });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.analyticsSearched = async (req, res) => {
  try {
    // Top 8 books by views as "most searched/viewed"
    const books = await Book.find({ views: { $gt: 0 } }).sort({ views: -1 }).limit(8).select('title views');
    res.json(books);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.listCategories = async (req, res) => {
  try {
    const cats = await Category.find().select('name');
    res.json(cats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = exports;
