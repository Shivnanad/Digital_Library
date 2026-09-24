import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { getPurchasedBooks, getMyOrders, getInvoice, resendInvoiceEmail, downloadInvoicePDF, cancelOrderItem } from "../services/orderService";
import "../styles/myLibrary.css";

/* ─── SVG Icons ─── */
const Icon = ({ d, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  search:    "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  filter:    "M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
  grid:      "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  list:      "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  book:      "M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 004 17V5a2 2 0 012-2h14v14H6.5A2.5 2.5 0 004 19.5z",
  read:      "M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z",
  download:  "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",
  invoice:   "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  mail:      "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6",
  star:      "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  check:     "M20 6L9 17l-5-5",
  heart:     "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z",
  clock:     "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z",
  close:     "M18 6L6 18M6 6l12 12",
  alert:     "M12 9v4m0 4h.01M10.29 3.86l-8.5 14.14A1 1 0 002.65 19h18.7a1 1 0 00.86-1.5l-8.5-14.14a1 1 0 00-1.72 0z",
};

const FILTER_CATEGORIES = ["All", "Fiction", "Non-Fiction", "Science", "Technology", "Self-Help", "Business", "History", "Philosophy"];
const CANCEL_REASON_OPTIONS = [
  "Ordered by mistake",
  "Found a better option",
  "Not interested anymore",
  "Content quality issue",
  "Technical/access issue",
  "Other",
];
const REFUND_METHOD_OPTIONS = [
  { label: "UPI", value: "upi" },
  { label: "Debit Card", value: "debit" },
  { label: "Credit Card", value: "credit" },
  { label: "Net Banking", value: "netbanking" },
  { label: "Wallet", value: "wallet" },
];

export default function MyLibrary() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const justPurchased = location.state?.justPurchased || false;

  const [books, setBooks] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("books"); // books | orders
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [viewMode, setViewMode] = useState("grid"); // grid | list
  const [sortBy, setSortBy] = useState("recent"); // recent | title | author | price
  const [showInvoice, setShowInvoice] = useState(null); // order for invoice modal
  const [invoiceData, setInvoiceData] = useState(null);
  const [sendingEmail, setSendingEmail] = useState(null);
  const [successBanner, setSuccessBanner] = useState(justPurchased);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState(CANCEL_REASON_OPTIONS[0]);
  const [cancelRefundMethod, setCancelRefundMethod] = useState("upi");
  const [cancelRefundDetails, setCancelRefundDetails] = useState({
    upiId: "",
    cardLast4: "",
    cardHolder: "",
    accountNumber: "",
    ifsc: "",
    walletType: "",
    walletMobile: "",
  });
  const [cancelNotes, setCancelNotes] = useState("");
  const [cancellingBookKey, setCancellingBookKey] = useState("");

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    loadData();
  }, [user]);

  useEffect(() => {
    if (successBanner) {
      const timer = setTimeout(() => setSuccessBanner(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [successBanner]);

  const loadData = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [booksData, ordersData] = await Promise.all([
        getPurchasedBooks(),
        getMyOrders(),
      ]);
      setBooks(booksData);
      setOrders(ordersData);
    } catch (err) {
      console.error("Failed to load library:", err);
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    const t = setInterval(() => {
      loadData({ silent: true });
    }, 8000);
    return () => clearInterval(t);
  }, [user]);

  /* ── Filtered & sorted books ── */
  const filteredBooks = useMemo(() => {
    let result = [...books];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          b.title?.toLowerCase().includes(q) ||
          b.author?.toLowerCase().includes(q) ||
          b.category?.name?.toLowerCase().includes(q)
      );
    }

    // Category filter
    if (selectedCategory !== "All") {
      result = result.filter(
        (b) => b.category?.name?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // Sort
    switch (sortBy) {
      case "title":
        result.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
        break;
      case "author":
        result.sort((a, b) => (a.author || "").localeCompare(b.author || ""));
        break;
      case "price":
        result.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      default: // recent — reverse (newest first)
        result.reverse();
    }

    return result;
  }, [books, searchQuery, selectedCategory, sortBy]);

  /* ── Invoice modal ── */
  const openInvoice = async (order) => {
    setShowInvoice(order);
    try {
      const data = await getInvoice(order._id);
      setInvoiceData(data);
    } catch {
      setInvoiceData({ order, user: { name: user?.name, email: user?.email } });
    }
  };

  const closeInvoice = () => {
    setShowInvoice(null);
    setInvoiceData(null);
  };

  /* ── Download invoice as PDF from backend ── */
  const downloadInvoice = async () => {
    if (!showInvoice?._id) { window.print(); return; }
    try {
      const blob = await downloadInvoicePDF(showInvoice._id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Readify_Invoice_${showInvoice.invoiceNumber || "invoice"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF download failed:", err);
      window.print(); // fallback
    }
  };

  /* ── Resend email ── */
  const handleResendEmail = async (orderId) => {
    setSendingEmail(orderId);
    try {
      await resendInvoiceEmail(orderId);
      alert("Invoice email sent successfully!");
    } catch (err) {
      alert("Failed to send email: " + err.message);
    }
    setSendingEmail(null);
  };

  const openCancelModal = (order, item) => {
    setCancelTarget({
      orderId: order._id,
      orderNumber: order.invoiceNumber,
      bookId: item.book,
      title: item.title,
      author: item.author,
    });
    setCancelReason(CANCEL_REASON_OPTIONS[0]);
    setCancelRefundMethod("upi");
    setCancelRefundDetails({
      upiId: "",
      cardLast4: "",
      cardHolder: "",
      accountNumber: "",
      ifsc: "",
      walletType: "",
      walletMobile: "",
    });
    setCancelNotes("");
  };

  const closeCancelModal = () => {
    setCancelTarget(null);
    setCancelNotes("");
  };

  const submitCancelRefund = async () => {
    if (!cancelTarget) return;

    const details = cancelNotes.trim();
    const finalReason = cancelReason === "Other"
      ? details
      : (details ? `${cancelReason} - ${details}` : cancelReason);

    if (!finalReason || finalReason.length < 5) {
      alert("Please provide a detailed cancellation reason.");
      return;
    }

    let payloadDetails = {};
    if (cancelRefundMethod === "upi") {
      const upiId = String(cancelRefundDetails.upiId || "").trim().toLowerCase();
      if (!upiId || !upiId.includes("@")) {
        alert("Please enter a valid UPI ID.");
        return;
      }
      payloadDetails = { upiId };
    }
    if (cancelRefundMethod === "debit" || cancelRefundMethod === "credit") {
      const cardLast4 = String(cancelRefundDetails.cardLast4 || "").replace(/\D/g, "").slice(-4);
      if (!/^\d{4}$/.test(cardLast4)) {
        alert("Please enter last 4 digits of your card.");
        return;
      }
      payloadDetails = {
        cardLast4,
        cardHolder: String(cancelRefundDetails.cardHolder || "").trim(),
      };
    }
    if (cancelRefundMethod === "netbanking") {
      const accountNumber = String(cancelRefundDetails.accountNumber || "").replace(/\s/g, "");
      const ifsc = String(cancelRefundDetails.ifsc || "").trim().toUpperCase();
      if (accountNumber.length < 6 || !ifsc) {
        alert("Please enter a valid account number and IFSC.");
        return;
      }
      payloadDetails = { accountNumber, ifsc };
    }
    if (cancelRefundMethod === "wallet") {
      const walletType = String(cancelRefundDetails.walletType || "").trim();
      const walletMobile = String(cancelRefundDetails.walletMobile || "").replace(/\D/g, "");
      if (!walletType || walletMobile.length < 10) {
        alert("Please enter wallet type and valid wallet mobile number.");
        return;
      }
      payloadDetails = { walletType, walletMobile };
    }

    const key = `${cancelTarget.orderId}:${cancelTarget.bookId}`;
    setCancellingBookKey(key);
    try {
      await cancelOrderItem(cancelTarget.orderId, cancelTarget.bookId, finalReason, cancelRefundMethod, payloadDetails);
      await loadData();
      closeCancelModal();
      alert("Cancellation request submitted. Admin will review and process your refund.");
    } catch (err) {
      alert("Failed to submit cancellation request: " + err.message);
    }
    setCancellingBookKey("");
  };

  const getOrderStatusIcon = (status) => {
    if (status === "pending") return ICONS.clock;
    if (status === "failed") return ICONS.close;
    if (status === "refunded" || status === "partially_refunded") return ICONS.alert;
    return ICONS.check;
  };

  const getItemStatus = (item) => item?.status || "purchased";

  if (!user) return null;

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="ml-page">
        <div className="ml-loading">
          <div className="ml-loading-spinner" />
          <p>Loading your library...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ml-page">

      {/* Success banner after purchase */}
      {successBanner && (
        <div className="ml-success-banner">
          <div className="ml-success-content">
            <span className="ml-success-icon">🎉</span>
            <div>
              <strong>Payment Successful!</strong>
              <p>Your books have been added to your library. Invoice sent to your email.</p>
            </div>
            <button className="ml-success-close" onClick={() => setSuccessBanner(false)}>
              <Icon d={ICONS.close} size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── Hero section ── */}
      <div className="ml-hero">
        <div className="ml-hero-bg" />
        <div className="ml-hero-content">
          <div className="ml-hero-icon">📚</div>
          <h1 className="ml-hero-title">My Library</h1>
          <p className="ml-hero-sub">Your personal collection of {books.length} {books.length === 1 ? "book" : "books"}</p>
        </div>
      </div>

      {/* ── Tab navigation ── */}
      <div className="ml-tabs">
        <button className={`ml-tab ${activeTab === "books" ? "active" : ""}`} onClick={() => setActiveTab("books")}>
          <Icon d={ICONS.book} size={18} />
          <span>My Books ({books.length})</span>
        </button>
        <button className={`ml-tab ${activeTab === "orders" ? "active" : ""}`} onClick={() => setActiveTab("orders")}>
          <Icon d={ICONS.invoice} size={18} />
          <span>Order History ({orders.length})</span>
        </button>
      </div>

      {/* ══════════ BOOKS TAB ══════════ */}
      {activeTab === "books" && (
        <div className="ml-content">

          {/* Toolbar */}
          <div className="ml-toolbar">
            <div className="ml-search-wrap">
              <Icon d={ICONS.search} size={18} />
              <input
                type="text"
                className="ml-search"
                placeholder="Search your books..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="ml-search-clear" onClick={() => setSearchQuery("")}>
                  <Icon d={ICONS.close} size={14} />
                </button>
              )}
            </div>

            <div className="ml-toolbar-right">
              <select className="ml-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="recent">Recently Added</option>
                <option value="title">Title A-Z</option>
                <option value="author">Author A-Z</option>
                <option value="price">Price High-Low</option>
              </select>

              <div className="ml-view-toggle">
                <button className={viewMode === "grid" ? "active" : ""} onClick={() => setViewMode("grid")} title="Grid view">
                  <Icon d={ICONS.grid} size={16} />
                </button>
                <button className={viewMode === "list" ? "active" : ""} onClick={() => setViewMode("list")} title="List view">
                  <Icon d={ICONS.list} size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Category filters */}
          <div className="ml-filters">
            {FILTER_CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`ml-filter-chip ${selectedCategory === cat ? "active" : ""}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Books Grid/List */}
          {filteredBooks.length === 0 ? (
            <div className="ml-empty">
              <div className="ml-empty-icon">📖</div>
              <h3>{books.length === 0 ? "Your library is empty" : "No books match your filters"}</h3>
              <p>{books.length === 0 ? "Purchase books to build your collection" : "Try adjusting your search or filters"}</p>
              {books.length === 0 && (
                <button className="ml-btn-primary" onClick={() => navigate("/app")}>
                  Browse Books
                </button>
              )}
            </div>
          ) : (
            <div className={`ml-books ${viewMode}`}>
              {filteredBooks.map((book) => (
                <div key={book._id} className="ml-book-card" onClick={() => navigate(`/book/${book._id}`)}>
                  <div className="ml-book-cover">
                    <img src={book.coverUrl || "/images/placeholder-book.png"} alt={book.title} />
                    <div className="ml-book-overlay">
                      <button className="ml-read-btn" onClick={(e) => { e.stopPropagation(); navigate(`/read/${book._id}`); }}>
                        <Icon d={ICONS.read} size={18} />
                        <span>Read Now</span>
                      </button>
                    </div>
                    <div className="ml-owned-badge">
                      <Icon d={ICONS.check} size={12} />
                      <span>Owned</span>
                    </div>
                  </div>
                  <div className="ml-book-info">
                    <h4 className="ml-book-title">{book.title}</h4>
                    <p className="ml-book-author">{book.author}</p>
                    <div className="ml-book-meta">
                      {book.category?.name && <span className="ml-book-cat">{book.category.name}</span>}
                      {book.rating > 0 && (
                        <span className="ml-book-rating">
                          <Icon d={ICONS.star} size={12} />
                          {book.rating}
                        </span>
                      )}
                    </div>
                    {viewMode === "list" && (
                      <div className="ml-book-extra">
                        {book.pages && <span>{book.pages} pages</span>}
                        {book.language && <span>{book.language}</span>}
                        <span className="ml-book-price">₹{book.price}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Results count */}
          {filteredBooks.length > 0 && (
            <div className="ml-results-count">
              Showing {filteredBooks.length} of {books.length} books
            </div>
          )}
        </div>
      )}

      {/* ══════════ ORDERS TAB ══════════ */}
      {activeTab === "orders" && (
        <div className="ml-content">
          {orders.length === 0 ? (
            <div className="ml-empty">
              <div className="ml-empty-icon">🧾</div>
              <h3>No orders yet</h3>
              <p>Your purchase history will appear here</p>
              <button className="ml-btn-primary" onClick={() => navigate("/app")}>
                Browse Books
              </button>
            </div>
          ) : (
            <div className="ml-orders">
              {orders.map((order) => (
                <div key={order._id} className="ml-order-card">
                  <div className="ml-order-header">
                    <div className="ml-order-id">
                      <span className="ml-order-label">Invoice</span>
                      <span className="ml-invoice-num">{order.invoiceNumber}</span>
                    </div>
                    <div className="ml-order-date">
                      <Icon d={ICONS.clock} size={14} />
                      {new Date(order.createdAt).toLocaleDateString("en-IN", {
                        year: "numeric", month: "short", day: "numeric"
                      })}
                    </div>
                    <div className={`ml-order-status ${order.paymentStatus}`}>
                      <Icon d={getOrderStatusIcon(order.paymentStatus)} size={14} />
                      {String(order.paymentStatus || "paid").replace("_", " ")}
                    </div>
                  </div>

                  <div className="ml-order-items">
                    {order.items?.map((item, i) => (
                      <div key={i} className="ml-order-item">
                        <img src={item.coverUrl || "/images/placeholder-book.png"} alt={item.title} className="ml-order-thumb" />
                        <div className="ml-order-item-info">
                          <div className="ml-order-item-title">{item.title}</div>
                          <div className="ml-order-item-author">{item.author}</div>
                          {getItemStatus(item) === "cancelled" && (
                            <div className="ml-item-cancel-meta">
                              <span className="ml-item-cancel-badge">Cancelled</span>
                              {item.cancelReason && <p>{item.cancelReason}</p>}
                            </div>
                          )}
                          {getItemStatus(item) === "cancel_requested" && (
                            <div className="ml-item-cancel-meta">
                              <span className="ml-item-cancel-badge pending">Pending Approval</span>
                              {item.cancelReason && <p>{item.cancelReason}</p>}
                            </div>
                          )}
                          {getItemStatus(item) === "cancel_rejected" && (
                            <div className="ml-item-cancel-meta">
                              <span className="ml-item-cancel-badge rejected">Request Rejected</span>
                              {item.cancelRejectReason && <p>{item.cancelRejectReason}</p>}
                            </div>
                          )}
                        </div>
                        <div className="ml-order-item-right">
                          <div className="ml-order-item-price">₹{(item.price * item.quantity).toFixed(2)}</div>
                          {(getItemStatus(item) === "purchased" || getItemStatus(item) === "cancel_rejected") ? (
                            <button
                              className="ml-action-btn danger"
                              disabled={cancellingBookKey === `${order._id}:${item.book}`}
                              onClick={() => openCancelModal(order, item)}
                              title="Cancel this purchased book"
                            >
                              {cancellingBookKey === `${order._id}:${item.book}` ? (
                                <span className="ml-mini-spinner" />
                              ) : (
                                <Icon d={ICONS.alert} size={14} />
                              )}
                              <span>Cancel</span>
                            </button>
                          ) : getItemStatus(item) === "cancel_requested" ? (
                            <button className="ml-action-btn" disabled title="Request already submitted">
                              <span>Requested</span>
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="ml-order-footer">
                    <div className="ml-order-total">
                      <span>Total Paid</span>
                      <strong>₹{order.total?.toFixed(2)}</strong>
                    </div>
                    <div className="ml-order-actions">
                      <button className="ml-action-btn" onClick={() => openInvoice(order)} title="View Invoice">
                        <Icon d={ICONS.download} size={16} />
                        <span>Invoice</span>
                      </button>
                      <button
                        className="ml-action-btn mail"
                        onClick={() => handleResendEmail(order._id)}
                        disabled={sendingEmail === order._id}
                        title="Resend to email"
                      >
                        {sendingEmail === order._id ? (
                          <span className="ml-mini-spinner" />
                        ) : (
                          <Icon d={ICONS.mail} size={16} />
                        )}
                        <span>Email</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════ INVOICE MODAL ══════════ */}
      {showInvoice && (
        <div className="ml-invoice-overlay" onClick={closeInvoice}>
          <div className="ml-invoice-modal" onClick={(e) => e.stopPropagation()}>
            <button className="ml-invoice-close" onClick={closeInvoice}>
              <Icon d={ICONS.close} size={20} />
            </button>

            <div className="ml-invoice-body" id="invoice-print">
              {/* Invoice Header */}
              <div className="ml-inv-header">
                <div className="ml-inv-brand">
                  <span className="ml-inv-logo">📚</span>
                  <div>
                    <div className="ml-inv-company">READIFY</div>
                    <div className="ml-inv-tagline">Digital Library</div>
                  </div>
                </div>
                <div className="ml-inv-title-block">
                  <div className="ml-inv-title">INVOICE</div>
                  <div className="ml-inv-number">{showInvoice.invoiceNumber}</div>
                </div>
              </div>

              {/* Invoice Meta */}
              <div className="ml-inv-meta">
                <div className="ml-inv-meta-item">
                  <div className="ml-inv-meta-label">Billed To</div>
                  <div className="ml-inv-meta-value">{invoiceData?.user?.name || user?.name}</div>
                  <div className="ml-inv-meta-sub">{invoiceData?.user?.email || user?.email}</div>
                </div>
                <div className="ml-inv-meta-item">
                  <div className="ml-inv-meta-label">Invoice Date</div>
                  <div className="ml-inv-meta-value">
                    {new Date(showInvoice.createdAt).toLocaleDateString("en-IN", {
                      year: "numeric", month: "long", day: "numeric"
                    })}
                  </div>
                </div>
                <div className="ml-inv-meta-item">
                  <div className="ml-inv-meta-label">Payment Method</div>
                  <div className="ml-inv-meta-value" style={{ textTransform: "uppercase" }}>
                    {showInvoice.paymentMethod}
                  </div>
                </div>
                <div className="ml-inv-meta-item">
                  <div className="ml-inv-meta-label">Status</div>
                  <div className="ml-inv-status-badge">
                    <Icon d={ICONS.check} size={14} />
                    Paid
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="ml-inv-table">
                <div className="ml-inv-thead">
                  <span className="ml-inv-col-item">Item</span>
                  <span className="ml-inv-col-qty">Qty</span>
                  <span className="ml-inv-col-price">Price</span>
                  <span className="ml-inv-col-total">Total</span>
                </div>
                {showInvoice.items?.map((item, i) => (
                  <div key={i} className="ml-inv-row">
                    <div className="ml-inv-col-item">
                      <img src={item.coverUrl || "/images/placeholder-book.png"} alt="" className="ml-inv-item-img" />
                      <div>
                        <div className="ml-inv-item-title">{item.title}</div>
                        <div className="ml-inv-item-author">{item.author}</div>
                      </div>
                    </div>
                    <span className="ml-inv-col-qty">{item.quantity}</span>
                    <span className="ml-inv-col-price">₹{item.price?.toFixed(2)}</span>
                    <span className="ml-inv-col-total">₹{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* GST Breakdown + Totals */}
              <div className="ml-inv-totals">
                <div className="ml-inv-total-row">
                  <span>Subtotal</span>
                  <span>₹{showInvoice.subtotal?.toFixed(2)}</span>
                </div>

                {/* GST Breakdown Box */}
                <div className="ml-inv-gst-box">
                  <div className="ml-inv-gst-header">
                    <span>📋 GST Summary (12%)</span>
                    <span>₹{showInvoice.tax?.toFixed(2)}</span>
                  </div>
                  {(showInvoice.igst > 0) ? (
                    <div className="ml-inv-gst-row">
                      <span>IGST @ 12%</span>
                      <span>₹{showInvoice.igst?.toFixed(2)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="ml-inv-gst-row">
                        <span>CGST @ 6%</span>
                        <span>₹{(showInvoice.cgst || (showInvoice.tax ? showInvoice.tax / 2 : 0))?.toFixed(2)}</span>
                      </div>
                      <div className="ml-inv-gst-row">
                        <span>SGST @ 6%</span>
                        <span>₹{(showInvoice.sgst || (showInvoice.tax ? showInvoice.tax / 2 : 0))?.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="ml-inv-total-row">
                  <span>Platform Fee (2%)</span>
                  <span>₹{showInvoice.platformFee?.toFixed(2)}</span>
                </div>
                {showInvoice.discount > 0 && (
                  <div className="ml-inv-total-row discount">
                    <span>Discount</span>
                    <span>-₹{showInvoice.discount?.toFixed(2)}</span>
                  </div>
                )}
                <div className="ml-inv-grand-total">
                  <span>Total Paid</span>
                  <span>₹{showInvoice.total?.toFixed(2)}</span>
                </div>
              </div>

              {/* Invoice Footer */}
              <div className="ml-inv-footer">
                <p>Thank you for your purchase! Your books are available in your library.</p>
                <p className="ml-inv-support">Questions? Contact us at <a href="mailto:support@readify.app">support@readify.app</a></p>
                <div className="ml-inv-copyright">© 2026 Readify · Digital Library</div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="ml-invoice-actions">
              <button className="ml-inv-btn download" onClick={downloadInvoice}>
                <Icon d={ICONS.download} size={18} />
                Download / Print
              </button>
              <button
                className="ml-inv-btn email"
                onClick={() => handleResendEmail(showInvoice._id)}
                disabled={sendingEmail === showInvoice._id}
              >
                {sendingEmail === showInvoice._id ? (
                  <span className="ml-mini-spinner" />
                ) : (
                  <Icon d={ICONS.mail} size={18} />
                )}
                Send to Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel/Refund Modal */}
      {cancelTarget && (
        <div className="ml-cancel-overlay" onClick={closeCancelModal}>
          <div className="ml-cancel-modal" onClick={(e) => e.stopPropagation()}>
            <button className="ml-cancel-close" onClick={closeCancelModal}>
              <Icon d={ICONS.close} size={18} />
            </button>

            <div className="ml-cancel-head">
              <div className="ml-cancel-icon"><Icon d={ICONS.alert} size={20} /></div>
              <h3>Cancel This Purchase?</h3>
              <p>Once cancelled, this book will disappear from your active library.</p>
            </div>

            <div className="ml-cancel-book">
              <div className="ml-cancel-book-title">{cancelTarget.title}</div>
              <div className="ml-cancel-book-sub">{cancelTarget.author} • Invoice {cancelTarget.orderNumber}</div>
            </div>

            <label className="ml-cancel-label">Reason for cancellation</label>
            <select className="ml-cancel-select" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}>
              {CANCEL_REASON_OPTIONS.map((reason) => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </select>

            <label className="ml-cancel-label">Refund payment method</label>
            <select className="ml-cancel-select" value={cancelRefundMethod} onChange={(e) => setCancelRefundMethod(e.target.value)}>
              {REFUND_METHOD_OPTIONS.map((method) => (
                <option key={method.value} value={method.value}>{method.label}</option>
              ))}
            </select>

            {cancelRefundMethod === "upi" && (
              <>
                <label className="ml-cancel-label">UPI ID</label>
                <input
                  className="ml-cancel-select"
                  type="text"
                  placeholder="example@upi"
                  value={cancelRefundDetails.upiId}
                  onChange={(e) => setCancelRefundDetails((p) => ({ ...p, upiId: e.target.value }))}
                />
              </>
            )}

            {(cancelRefundMethod === "debit" || cancelRefundMethod === "credit") && (
              <>
                <label className="ml-cancel-label">Card Holder Name</label>
                <input
                  className="ml-cancel-select"
                  type="text"
                  placeholder="Name on card"
                  value={cancelRefundDetails.cardHolder}
                  onChange={(e) => setCancelRefundDetails((p) => ({ ...p, cardHolder: e.target.value }))}
                />
                <label className="ml-cancel-label">Card Last 4 Digits</label>
                <input
                  className="ml-cancel-select"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="1234"
                  value={cancelRefundDetails.cardLast4}
                  onChange={(e) => setCancelRefundDetails((p) => ({ ...p, cardLast4: e.target.value }))}
                />
              </>
            )}

            {cancelRefundMethod === "netbanking" && (
              <>
                <label className="ml-cancel-label">Bank Account Number</label>
                <input
                  className="ml-cancel-select"
                  type="text"
                  inputMode="numeric"
                  placeholder="Account number"
                  value={cancelRefundDetails.accountNumber}
                  onChange={(e) => setCancelRefundDetails((p) => ({ ...p, accountNumber: e.target.value }))}
                />
                <label className="ml-cancel-label">IFSC Code</label>
                <input
                  className="ml-cancel-select"
                  type="text"
                  placeholder="e.g. HDFC0001234"
                  value={cancelRefundDetails.ifsc}
                  onChange={(e) => setCancelRefundDetails((p) => ({ ...p, ifsc: e.target.value.toUpperCase() }))}
                />
              </>
            )}

            {cancelRefundMethod === "wallet" && (
              <>
                <label className="ml-cancel-label">Wallet Type</label>
                <input
                  className="ml-cancel-select"
                  type="text"
                  placeholder="Paytm / PhonePe / Amazon Pay"
                  value={cancelRefundDetails.walletType}
                  onChange={(e) => setCancelRefundDetails((p) => ({ ...p, walletType: e.target.value }))}
                />
                <label className="ml-cancel-label">Wallet Mobile Number</label>
                <input
                  className="ml-cancel-select"
                  type="text"
                  inputMode="numeric"
                  placeholder="10-digit mobile"
                  value={cancelRefundDetails.walletMobile}
                  onChange={(e) => setCancelRefundDetails((p) => ({ ...p, walletMobile: e.target.value }))}
                />
              </>
            )}

            <label className="ml-cancel-label">Tell us more</label>
            <textarea
              className="ml-cancel-textarea"
              rows={3}
              placeholder="Share short details (optional unless reason is Other)"
              value={cancelNotes}
              onChange={(e) => setCancelNotes(e.target.value)}
            />

            <div className="ml-cancel-actions">
              <button className="ml-cancel-btn ghost" onClick={closeCancelModal}>Keep Book</button>
              <button className="ml-cancel-btn danger" onClick={submitCancelRefund}>
                Submit Cancel Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
