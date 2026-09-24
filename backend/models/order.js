const mongoose = require("mongoose");
const { Schema } = mongoose;

const orderItemSchema = new mongoose.Schema({
  book: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Book",
    required: true,
  },
  title: { type: String, required: true },
  author: { type: String },
  coverUrl: { type: String },
  price: { type: Number, required: true },
  quantity: { type: Number, default: 1 },
  status: {
    type: String,
    enum: ["purchased", "cancel_requested", "cancelled", "cancel_rejected"],
    default: "purchased",
  },
  cancelReason: { type: String, default: "" },
  refundMethodRequested: {
    type: String,
    enum: ["upi", "debit", "credit", "netbanking", "wallet"],
    default: null,
  },
  refundMethodApproved: {
    type: String,
    enum: ["upi", "debit", "credit", "netbanking", "wallet"],
    default: null,
  },
  refundDetailsRequested: { type: Schema.Types.Mixed, default: null },
  refundDetailsApproved: { type: Schema.Types.Mixed, default: null },
  cancelRequestedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  cancelReviewedAt: { type: Date, default: null },
  cancelRejectReason: { type: String, default: "" },
});

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    invoiceNumber: {
      type: String,
      unique: true,
      required: true,
    },
    items: [orderItemSchema],
    subtotal: { type: Number, required: true },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    platformFee: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    paymentMethod: {
      type: String,
      enum: ["upi", "visa", "card", "mastercard", "rupay", "netbanking", "wallet"],
      default: "upi",
    },
    paymentStatus: {
      type: String,
      enum: ["paid", "pending", "failed", "refunded", "partially_refunded"],
      default: "paid",
    },
    emailSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

/* Auto-generate invoice number: RDY-20260301-XXXX */
orderSchema.statics.generateInvoiceNumber = async function () {
  const today = new Date();
  const dateStr =
    today.getFullYear().toString() +
    String(today.getMonth() + 1).padStart(2, "0") +
    String(today.getDate()).padStart(2, "0");

  const count = await this.countDocuments({
    createdAt: {
      $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
    },
  });

  return `RDY-${dateStr}-${String(count + 1).padStart(4, "0")}`;
};

module.exports = mongoose.model("Order", orderSchema);
