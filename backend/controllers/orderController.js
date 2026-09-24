const User = require("../models/User");
const Book = require("../models/Book");
const Order = require("../models/order");
const { sendInvoiceEmail, sendCancellationEmail } = require("../utils/invoiceEmail");
const { generateInvoicePDF } = require("../utils/invoicePDF");

async function syncUserPurchasedBooks(userId) {
  const orders = await Order.find({ user: userId, paymentStatus: { $ne: "failed" } })
    .select("items")
    .lean();

  const activeBookIds = new Set();
  orders.forEach((order) => {
    (order.items || []).forEach((item) => {
      if (item?.status !== "cancelled" && item?.book) {
        activeBookIds.add(item.book.toString());
      }
    });
  });

  const ids = Array.from(activeBookIds).map((id) => id);
  await User.updateOne({ _id: userId }, { $set: { purchasedBooks: ids } });
  return ids;
}

/* ─── POST /api/orders/purchase
       Body: { bookIds, items, subtotal, cgst, sgst, igst, tax, platformFee, discount, total, paymentMethod }
       Creates order record, marks books as purchased, sends invoice email with PDF ─── */
exports.purchaseBooks = async (req, res) => {
  try {
    const {
      bookIds,
      items,
      subtotal = 0,
      cgst = 0,
      sgst = 0,
      igst = 0,
      tax = 0,
      platformFee = 0,
      discount = 0,
      total = 0,
      paymentMethod = "upi",
    } = req.body;

    if (!bookIds || !Array.isArray(bookIds) || bookIds.length === 0) {
      return res.status(400).json({ message: "bookIds array is required" });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    /* Fetch books for order items */
    const books = await Book.find({ _id: { $in: bookIds } }).populate("category");

    /* Build order items — use frontend items if provided, else build from DB */
    const orderItems = books.map((book) => {
      const frontItem = items?.find(
        (it) => it._id === book._id.toString() || it._id === book.id
      );
      return {
        book: book._id,
        title: book.title,
        author: book.author,
        coverUrl: book.coverUrl || "",
        price: frontItem?.price ?? book.price ?? 0,
        quantity: frontItem?.quantity ?? 1,
      };
    });

    /* Generate invoice number */
    const invoiceNumber = await Order.generateInvoiceNumber();

    /* Calculate totals — split GST into CGST + SGST */
    const calcSubtotal =
      subtotal ||
      orderItems.reduce((s, it) => s + it.price * it.quantity, 0);

    const calcCGST = cgst || +(calcSubtotal * 0.06).toFixed(2);
    const calcSGST = sgst || +(calcSubtotal * 0.06).toFixed(2);
    const calcIGST = igst || 0;
    const calcTax = tax || +(calcCGST + calcSGST + calcIGST).toFixed(2);
    const calcPlatformFee = platformFee || +(calcSubtotal * 0.02).toFixed(2);
    const calcTotal =
      total || +(calcSubtotal + calcTax + calcPlatformFee - discount).toFixed(2);

    /* Create order */
    const order = await Order.create({
      user: user._id,
      invoiceNumber,
      items: orderItems,
      subtotal: calcSubtotal,
      cgst: calcCGST,
      sgst: calcSGST,
      igst: calcIGST,
      tax: calcTax,
      platformFee: calcPlatformFee,
      discount,
      total: calcTotal,
      paymentMethod,
      paymentStatus: "paid",
    });

    /* Mark books as purchased on user (avoid duplicates) */
    const existing = user.purchasedBooks.map((id) => id.toString());
    const toAdd = bookIds.filter((id) => !existing.includes(id.toString()));
    user.purchasedBooks.push(...toAdd);
    await user.save();

    /* Send invoice email (non-blocking) */
    sendInvoiceEmail(order, user.email, user.name).then((sent) => {
      if (sent) {
        Order.updateOne({ _id: order._id }, { emailSent: true }).exec();
      }
    });

    res.json({
      message: "Purchase recorded",
      purchasedBooks: user.purchasedBooks,
      order: {
        _id: order._id,
        invoiceNumber: order.invoiceNumber,
        total: order.total,
        createdAt: order.createdAt,
      },
    });
  } catch (err) {
    console.error("Purchase error:", err);
    res
      .status(500)
      .json({ message: "Failed to record purchase", error: err.message });
  }
};

/* ─── GET /api/orders/purchased
       Returns the list of purchased books for the logged-in user ─── */
exports.getPurchasedBooks = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: "purchasedBooks",
      select: "title author coverUrl pdfUrl price category rating language pages",
      populate: { path: "category", select: "name" },
    });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ purchasedBooks: user.purchasedBooks });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch purchased books", error: err.message });
  }
};

/* ─── GET /api/orders/purchased/:bookId
       Check if a single book is purchased by the user ─── */
exports.checkPurchased = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const purchased = user.purchasedBooks
      .map((id) => id.toString())
      .includes(req.params.bookId);

    res.json({ purchased });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to check purchase", error: err.message });
  }
};

/* ─── GET /api/orders/my-orders
       Full order history with items, totals, invoice numbers ─── */
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ orders });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch orders", error: err.message });
  }
};

/* POST /api/orders/:orderId/items/:bookId/cancel
   Body: { reason, refundMethod }
   User submits cancellation request; admin approves/rejects later */
exports.cancelOrderItem = async (req, res) => {
  try {
    const { reason = "", refundMethod = "", refundDetails = {} } = req.body || {};
    const cleanReason = String(reason).trim();
    const cleanMethod = String(refundMethod).trim().toLowerCase();
    const allowedMethods = ["upi", "debit", "credit", "netbanking", "wallet"];

    const details = (refundDetails && typeof refundDetails === "object") ? refundDetails : {};
    let normalizedDetails = {};

    if (!cleanReason || cleanReason.length < 5) {
      return res.status(400).json({ message: "Please provide a valid cancellation reason" });
    }

    if (!allowedMethods.includes(cleanMethod)) {
      return res.status(400).json({ message: "Please select a valid refund method" });
    }

    if (cleanMethod === "upi") {
      const upiId = String(details.upiId || "").trim().toLowerCase();
      if (!upiId || !upiId.includes("@")) {
        return res.status(400).json({ message: "Please provide a valid UPI ID" });
      }
      normalizedDetails = { upiId };
    }

    if (cleanMethod === "debit" || cleanMethod === "credit") {
      const cardLast4 = String(details.cardLast4 || "").replace(/\D/g, "").slice(-4);
      if (!/^\d{4}$/.test(cardLast4)) {
        return res.status(400).json({ message: "Please provide valid last 4 digits of card" });
      }
      normalizedDetails = {
        cardLast4,
        cardHolder: String(details.cardHolder || "").trim(),
      };
    }

    if (cleanMethod === "netbanking") {
      const accountNumber = String(details.accountNumber || "").replace(/\s/g, "");
      const ifsc = String(details.ifsc || "").trim().toUpperCase();
      if (accountNumber.length < 6 || !ifsc) {
        return res.status(400).json({ message: "Please provide valid account number and IFSC" });
      }
      normalizedDetails = { accountNumber, ifsc };
    }

    if (cleanMethod === "wallet") {
      const walletType = String(details.walletType || "").trim();
      const walletMobile = String(details.walletMobile || "").replace(/\D/g, "");
      if (!walletType || walletMobile.length < 10) {
        return res.status(400).json({ message: "Please provide valid wallet type and mobile number" });
      }
      normalizedDetails = { walletType, walletMobile };
    }

    const order = await Order.findOne({
      _id: req.params.orderId,
      user: req.user._id,
    });

    if (!order) return res.status(404).json({ message: "Order not found" });

    const item = (order.items || []).find(
      (it) => it.book?.toString() === req.params.bookId
    );

    if (!item) {
      return res.status(404).json({ message: "Book not found in this order" });
    }

    if (item.status === "cancelled") {
      return res.status(400).json({ message: "This book is already cancelled" });
    }

    if (item.status === "cancel_requested") {
      return res.status(400).json({ message: "Cancellation request already submitted" });
    }

    item.status = "cancel_requested";
    item.cancelReason = cleanReason;
    item.refundMethodRequested = cleanMethod;
    item.refundDetailsRequested = normalizedDetails;
    item.cancelRequestedAt = new Date();
    item.cancelRejectReason = "";
    item.cancelReviewedAt = null;

    await order.save();

    res.json({
      message: "Cancellation request submitted. Awaiting admin approval.",
      orderId: order._id,
      bookId: req.params.bookId,
      paymentStatus: order.paymentStatus,
      requestedItem: {
        title: item.title,
        author: item.author,
        cancelReason: item.cancelReason,
        refundMethodRequested: item.refundMethodRequested,
        refundDetailsRequested: item.refundDetailsRequested,
        cancelRequestedAt: item.cancelRequestedAt,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to submit cancellation request", error: err.message });
  }
};

/* ─── GET /api/orders/:orderId/invoice
       Returns full invoice data for a specific order ─── */
exports.getInvoice = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.orderId,
      user: req.user._id,
    }).lean();

    if (!order) return res.status(404).json({ message: "Order not found" });

    const user = await User.findById(req.user._id).select("name email");

    res.json({
      order,
      user: { name: user.name, email: user.email },
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch invoice", error: err.message });
  }
};

/* ─── POST /api/orders/:orderId/resend-email
       Resend invoice email for a specific order ─── */
exports.resendInvoiceEmail = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.orderId,
      user: req.user._id,
    });

    if (!order) return res.status(404).json({ message: "Order not found" });

    const user = await User.findById(req.user._id);
    const sent = await sendInvoiceEmail(order, user.email, user.name);

    if (sent) {
      order.emailSent = true;
      await order.save();
      res.json({ message: "Invoice email sent successfully" });
    } else {
      res.status(500).json({ message: "Failed to send email" });
    }
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to resend email", error: err.message });
  }
};

/* ─── GET /api/orders/:orderId/invoice/pdf
       Returns downloadable PDF invoice buffer ─── */
exports.downloadInvoicePDF = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.orderId,
      user: req.user._id,
    }).lean();

    if (!order) return res.status(404).json({ message: "Order not found" });

    const user = await User.findById(req.user._id).select("name email");

    const pdfBuffer = await generateInvoicePDF(order, {
      name: user.name,
      email: user.email,
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Readify_Invoice_${order.invoiceNumber}.pdf"`,
      "Content-Length": pdfBuffer.length,
    });

    res.send(pdfBuffer);
  } catch (err) {
    console.error("PDF download error:", err);
    res
      .status(500)
      .json({ message: "Failed to generate PDF", error: err.message });
  }
};
