const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middlewares/authMiddleware");
const {
  purchaseBooks,
  getPurchasedBooks,
  checkPurchased,
  getMyOrders,
  getInvoice,
  resendInvoiceEmail,
  downloadInvoicePDF,
  cancelOrderItem,
} = require("../controllers/orderController");

router.use(requireAuth);

router.post("/purchase", purchaseBooks);
router.get("/purchased", getPurchasedBooks);
router.get("/my-orders", getMyOrders);
router.post("/:orderId/items/:bookId/cancel", cancelOrderItem);
router.get("/:orderId/invoice/pdf", downloadInvoicePDF);
router.get("/:orderId/invoice", getInvoice);
router.post("/:orderId/resend-email", resendInvoiceEmail);
router.get("/purchased/:bookId", checkPurchased);

module.exports = router;
