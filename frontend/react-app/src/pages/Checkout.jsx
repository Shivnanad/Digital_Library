import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getCart, clearCart } from "../services/cartService";
import { purchaseBooks } from "../services/orderService";
import "../styles/checkout.css";

/* ── SVG logos ── */
const UpiLogo = () => (
  <svg viewBox="0 0 48 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="pm-logo">
    <text x="0" y="19" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="15" fill="#097939">U</text>
    <text x="13" y="19" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="15" fill="#ed1c24">P</text>
    <text x="26" y="19" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="15" fill="#f7941d">I</text>
  </svg>
);

const VisaLogo = () => (
  <svg viewBox="0 0 80 26" fill="none" xmlns="http://www.w3.org/2000/svg" className="pm-logo">
    <rect width="80" height="26" rx="4" fill="#1a1f71"/>
    <text x="8" y="20" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="18" fill="white" letterSpacing="1">VISA</text>
  </svg>
);

const MasterLogo = () => (
  <svg viewBox="0 0 48 30" fill="none" xmlns="http://www.w3.org/2000/svg" className="pm-logo">
    <circle cx="18" cy="15" r="12" fill="#eb001b" opacity="0.9"/>
    <circle cx="30" cy="15" r="12" fill="#f79e1b" opacity="0.9"/>
    <path d="M24 6.5a12 12 0 0 1 0 17" fill="#ff5f00"/>
  </svg>
);

const RupayLogo = () => (
  <svg viewBox="0 0 70 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="pm-logo">
    <rect width="70" height="24" rx="4" fill="#097939"/>
    <text x="6" y="17" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="12" fill="white" letterSpacing="0.5">RuPay</text>
  </svg>
);

const NetBankLogo = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="pm-logo pm-logo-icon">
    <path d="M3 21h18M12 3l9 6H3l9-6zM5 9v9M9 9v9M15 9v9M19 9v9" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const WalletLogo = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="pm-logo pm-logo-icon">
    <rect x="2" y="5" width="20" height="14" rx="3" stroke="#a78bfa" strokeWidth="2"/>
    <circle cx="17" cy="12" r="2" fill="#a78bfa"/>
    <path d="M6 5V4a2 2 0 012-2h8a2 2 0 012 2v1" stroke="#a78bfa" strokeWidth="1.5"/>
  </svg>
);

const UPI_SUGGESTIONS = [
  { handle: "@okaxis",   label: "Axis Bank" },
  { handle: "@oksbi",    label: "SBI"        },
  { handle: "@okicici",  label: "ICICI"      },
  { handle: "@paytm",    label: "Paytm"      },
  { handle: "@ybl",      label: "PhonePe"    },
  { handle: "@ibl",      label: "IndusInd"   },
];

const BANKS = [
  { id: "sbi",    name: "State Bank of India",   code: "SBI",   color: "#1d4ed8" },
  { id: "hdfc",   name: "HDFC Bank",             code: "HDFC",  color: "#00468b" },
  { id: "icici",  name: "ICICI Bank",            code: "ICIC",  color: "#f97316" },
  { id: "axis",   name: "Axis Bank",             code: "AXIS",  color: "#8b2252" },
  { id: "kotak",  name: "Kotak Mahindra Bank",   code: "KOTK",  color: "#d62828" },
  { id: "bob",    name: "Bank of Baroda",         code: "BOB",   color: "#f97316" },
  { id: "pnb",    name: "Punjab National Bank",  code: "PNB",   color: "#1d4ed8" },
  { id: "canara", name: "Canara Bank",           code: "CNRA",  color: "#059669" },
];

const WALLETS = [
  { id: "paytm",   name: "Paytm",     color: "#00baf2", icon: "₹" },
  { id: "phonepe", name: "PhonePe",   color: "#5f259f", icon: "P" },
  { id: "amazon",  name: "Amazon Pay",color: "#ff9900", icon: "A" },
  { id: "freecharge", name: "Freecharge", color: "#8B5CF6", icon: "F" },
  { id: "mobikwik", name: "MobiKwik", color: "#2563EB", icon: "M" },
  { id: "jio",     name: "JioPay",    color: "#0a3b8e", icon: "J" },
];

function formatCardNumber(val) {
  return val.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}
function formatExpiry(val) {
  const digits = val.replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) return digits.slice(0, 2) + "/" + digits.slice(2);
  return digits;
}

/* ── Purchase success sound (celebratory chime) ── */
function playPurchaseSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    const playNote = (freq, start, dur, vol = 0.12) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(vol, now + start);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur);
    };
    // Rising celebratory arpeggio: C5 → E5 → G5 → C6
    playNote(523.25, 0, 0.2, 0.1);      // C5
    playNote(659.25, 0.12, 0.2, 0.1);   // E5
    playNote(783.99, 0.24, 0.2, 0.1);   // G5
    playNote(1046.50, 0.36, 0.35, 0.13);// C6 (longer, slightly louder)
    // Sparkle shimmer
    playNote(1318.51, 0.5, 0.15, 0.06); // E6
    playNote(1567.98, 0.58, 0.2, 0.05); // G6
  } catch (e) { /* Audio not available */ }
}

export default function Checkout() {
  const { state } = useLocation();
  const navigate  = useNavigate();
  const single    = state?.book || null;

  const [processing,  setProcessing]  = useState(false);
  const [payMethod,   setPayMethod]   = useState("upi");

  /* UPI state */
  const [upiId,       setUpiId]       = useState("");
  const [upiError,    setUpiError]    = useState("");
  const [upiVerified, setUpiVerified] = useState(false);
  const [upiVerifying,setUpiVerifying]= useState(false);

  /* Card state (Visa / MasterCard / RuPay) */
  const [cardNumber, setCardNumber] = useState("");
  const [cardName,   setCardName]   = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv,    setCardCvv]    = useState("");
  const [cardErrors, setCardErrors] = useState({});
  const [cardType,   setCardType]   = useState("visa"); // visa, mastercard, rupay

  /* Net Banking state */
  const [selectedBank, setSelectedBank] = useState("");

  /* Wallet state */
  const [selectedWallet, setSelectedWallet] = useState("");
  const [walletPhone,    setWalletPhone]    = useState("");

  const items = useMemo(() => {
    if (single) return [{ _id: single._id, title: single.title, author: single.author, coverUrl: single.coverUrl || "/placeholder-book.png", quantity: 1, price: Number(single.price || 0) }];
    return getCart();
  }, [single]);

  /* ── GST Breakdown ── */
  const subtotal    = items.reduce((s, it) => s + (Number(it.price || 0) * (it.quantity || 1)), 0);
  const discount    = 0;
  const cgst        = +(subtotal * 0.06).toFixed(2);
  const sgst        = +(subtotal * 0.06).toFixed(2);
  const igst        = 0;
  const tax         = +(cgst + sgst + igst).toFixed(2);
  const platformFee = +(subtotal * 0.02).toFixed(2);
  const total       = +(subtotal - discount + tax + platformFee).toFixed(2);

  useEffect(() => {
    if (!single && (!items || items.length === 0)) navigate("/app");
  }, [items, single, navigate]);

  /* Reset verified state when UPI id changes */
  useEffect(() => { setUpiVerified(false); setUpiError(""); }, [upiId]);

  /* Auto-detect card type */
  useEffect(() => {
    const num = cardNumber.replace(/\s/g, "");
    if (num.startsWith("4")) setCardType("visa");
    else if (num.startsWith("5") || num.startsWith("2")) setCardType("mastercard");
    else if (num.startsWith("6") || num.startsWith("8")) setCardType("rupay");
  }, [cardNumber]);

  const validateUpi = (id) => /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/.test(id.trim());

  const handleVerifyUpi = async () => {
    if (!validateUpi(upiId)) { setUpiError("Enter a valid UPI ID (e.g. name@okaxis)"); return; }
    setUpiVerifying(true);
    await new Promise(r => setTimeout(r, 900));
    setUpiVerifying(false);
    setUpiVerified(true);
  };

  const validateCard = () => {
    const errs = {};
    if (cardNumber.replace(/\s/g, "").length < 16) errs.cardNumber = "Enter a valid 16-digit card number";
    if (!cardName.trim()) errs.cardName = "Name on card is required";
    const [mm] = cardExpiry.split("/");
    if (cardExpiry.length < 5 || +mm < 1 || +mm > 12) errs.cardExpiry = "Enter valid expiry (MM/YY)";
    if (cardCvv.replace(/\D/g,"").length < 3) errs.cardCvv = "Enter 3-digit CVV";
    setCardErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /* Determine backend payment method string */
  const getPaymentMethodString = () => {
    if (payMethod === "upi") return "upi";
    if (payMethod === "card") return cardType;
    if (payMethod === "netbanking") return "netbanking";
    if (payMethod === "wallet") return "wallet";
    return payMethod;
  };

  const handlePay = async () => {
    if (payMethod === "upi" && !upiVerified) { setUpiError("Please verify your UPI ID first"); return; }
    if (payMethod === "card" && !validateCard()) return;
    if (payMethod === "netbanking" && !selectedBank) return;
    if (payMethod === "wallet" && (!selectedWallet || walletPhone.replace(/\D/g, "").length < 10)) return;

    setProcessing(true);
    await new Promise(r => setTimeout(r, 1400));
    try {
      const bookIds = items.map((it) => it._id).filter(Boolean);
      let orderResult = null;
      if (bookIds.length > 0 && localStorage.getItem("token")) {
        orderResult = await purchaseBooks(bookIds, {
          items,
          subtotal,
          cgst,
          sgst,
          igst,
          tax,
          platformFee,
          discount,
          total,
          paymentMethod: getPaymentMethodString(),
        });
      }

      const ordersRaw = localStorage.getItem("readify_orders");
      const orders = ordersRaw ? JSON.parse(ordersRaw) : [];
      orders.push({
        id: orderResult?.order?._id || Date.now(),
        invoiceNumber: orderResult?.order?.invoiceNumber || null,
        createdAt: new Date().toISOString(),
        items,
        subtotal, cgst, sgst, igst, tax,
        platformFee,
        total,
        method: getPaymentMethodString(),
      });
      localStorage.setItem("readify_orders", JSON.stringify(orders));
    } catch (e) { console.error(e); }
    // Play purchase success sound
    playPurchaseSound();
    clearCart();
    setProcessing(false);
    navigate("/my-library", { replace: true, state: { justPurchased: true } });
  };

  /* ── Card gradient by type ── */
  const cardGradient = cardType === "mastercard"
    ? "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)"
    : cardType === "rupay"
    ? "linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)"
    : "linear-gradient(135deg, #1a1f71 0%, #2d3a8c 50%, #1a1f71 100%)";

  const CardTypeLogo = cardType === "mastercard" ? MasterLogo : cardType === "rupay" ? RupayLogo : VisaLogo;

  return (
    <div className="checkout-page">
      <div className="checkout-container">

        {/* ── LEFT ── */}
        <div className="checkout-left">
          <h1>Complete your purchase</h1>
          <p className="muted">Review your order and pay securely.</p>

          {/* Items */}
          <div className="items-list">
            {items.map((it) => (
              <div className="checkout-item" key={it._id}>
                <img src={it.coverUrl} alt={it.title} className="checkout-thumb" />
                <div className="checkout-meta">
                  <h3>{it.title}</h3>
                  <p className="muted">by {it.author}</p>
                </div>
                <div className="checkout-qty">×{it.quantity || 1}</div>
                <div className="checkout-price">₹{((it.price || 0) * (it.quantity || 1)).toFixed(2)}</div>
              </div>
            ))}
          </div>

          {/* Payment method tabs */}
          <div className="pm-section">
            <h3 className="pm-heading">Payment Method</h3>
            <div className="pm-tabs">
              <button className={`pm-tab ${payMethod === "upi" ? "active" : ""}`} onClick={() => setPayMethod("upi")}>
                <UpiLogo />
                <span>UPI</span>
              </button>
              <button className={`pm-tab ${payMethod === "card" ? "active" : ""}`} onClick={() => setPayMethod("card")}>
                <VisaLogo />
                <span>Card</span>
              </button>
              <button className={`pm-tab ${payMethod === "netbanking" ? "active" : ""}`} onClick={() => setPayMethod("netbanking")}>
                <NetBankLogo />
                <span>Net Banking</span>
              </button>
              <button className={`pm-tab ${payMethod === "wallet" ? "active" : ""}`} onClick={() => setPayMethod("wallet")}>
                <WalletLogo />
                <span>Wallet</span>
              </button>
            </div>

            {/* ── UPI Panel ── */}
            {payMethod === "upi" && (
              <div className="pm-panel upi-panel">
                <p className="pm-hint">Enter any UPI ID linked to your bank account.</p>

                <div className="upi-input-row">
                  <div className={`upi-input-wrap ${upiError ? "error" : ""} ${upiVerified ? "verified" : ""}`}>
                    <span className="upi-at">@</span>
                    <input
                      type="text"
                      className="upi-input"
                      placeholder="yourname@okaxis"
                      value={upiId}
                      onChange={e => setUpiId(e.target.value.toLowerCase().trim())}
                      maxLength={60}
                    />
                    {upiVerified && <span className="upi-tick">✓</span>}
                  </div>
                  <button className="upi-verify-btn" onClick={handleVerifyUpi} disabled={!upiId || upiVerifying || upiVerified}>
                    {upiVerifying ? <span className="upi-spinner" /> : upiVerified ? "Verified" : "Verify"}
                  </button>
                </div>

                {upiError && <p className="pm-error">{upiError}</p>}
                {upiVerified && <p className="pm-success">✓ UPI ID verified successfully</p>}

                <div className="upi-suggestions">
                  <p className="upi-sug-label">Quick fill — tap to add your handle:</p>
                  <div className="upi-sug-list">
                    {UPI_SUGGESTIONS.map(s => (
                      <button key={s.handle} className="upi-sug-chip"
                        onClick={() => {
                          const base = upiId.includes("@") ? upiId.split("@")[0] : upiId;
                          setUpiId((base || "username") + s.handle);
                        }}>
                        {s.handle} <span className="chip-label">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="upi-apps">
                  <p className="upi-sug-label">Works with:</p>
                  <div className="upi-app-list">
                    {[
                      { name: "GPay",    color: "#4285F4", letter: "G" },
                      { name: "PhonePe", color: "#5f259f", letter: "P" },
                      { name: "Paytm",   color: "#00baf2", letter: "₹" },
                      { name: "BHIM",    color: "#0066b3", letter: "B" },
                    ].map(app => (
                      <div key={app.name} className="upi-app-badge" style={{"--app-color": app.color}}>
                        <span className="app-icon">{app.letter}</span>
                        <span>{app.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Card Panel (Visa / MasterCard / RuPay) ── */}
            {payMethod === "card" && (
              <div className="pm-panel card-panel">
                {/* Card type selector */}
                <div className="card-type-selector">
                  <button className={`card-type-btn ${cardType === "visa" ? "active" : ""}`} onClick={() => setCardType("visa")} title="Visa">
                    <VisaLogo /><span>Visa</span>
                  </button>
                  <button className={`card-type-btn ${cardType === "mastercard" ? "active" : ""}`} onClick={() => setCardType("mastercard")} title="MasterCard">
                    <MasterLogo /><span>MasterCard</span>
                  </button>
                  <button className={`card-type-btn ${cardType === "rupay" ? "active" : ""}`} onClick={() => setCardType("rupay")} title="RuPay">
                    <RupayLogo /><span>RuPay</span>
                  </button>
                </div>

                {/* Visual card preview */}
                <div className="card-preview" style={{ background: cardGradient }}>
                  <div className="card-shine" />
                  <div className="card-preview-top">
                    <CardTypeLogo />
                    <div className="card-chip">
                      <svg viewBox="0 0 30 24" width="30" height="24"><rect x="0" y="6" width="30" height="12" rx="3" fill="#d4a853"/><rect x="10" y="0" width="10" height="24" rx="3" fill="#c49a3c"/><rect x="0" y="9" width="30" height="6" fill="#e0b96b" opacity="0.4"/></svg>
                    </div>
                  </div>
                  <div className="card-number-preview">
                    {(cardNumber || "•••• •••• •••• ••••")}
                  </div>
                  <div className="card-preview-bottom">
                    <div><div className="card-label">Card Holder</div><div className="card-value">{cardName || "YOUR NAME"}</div></div>
                    <div><div className="card-label">Expires</div><div className="card-value">{cardExpiry || "MM/YY"}</div></div>
                  </div>
                  <div className="card-contactless">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M7 17a8 8 0 010-10M11 15a4.5 4.5 0 010-6M15 13a1.5 1.5 0 010-2" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"/></svg>
                  </div>
                </div>

                <div className="visa-fields">
                  <div className={`visa-field ${cardErrors.cardNumber ? "has-error" : ""}`}>
                    <label>Card Number</label>
                    <input type="text" inputMode="numeric" placeholder="1234 5678 9012 3456"
                      value={cardNumber} maxLength={19}
                      onChange={e => { setCardNumber(formatCardNumber(e.target.value)); setCardErrors(p => ({...p, cardNumber: ""})); }} />
                    {cardErrors.cardNumber && <span className="field-err">{cardErrors.cardNumber}</span>}
                  </div>
                  <div className={`visa-field ${cardErrors.cardName ? "has-error" : ""}`}>
                    <label>Name on Card</label>
                    <input type="text" placeholder="John Doe"
                      value={cardName}
                      onChange={e => { setCardName(e.target.value.toUpperCase()); setCardErrors(p => ({...p, cardName: ""})); }} />
                    {cardErrors.cardName && <span className="field-err">{cardErrors.cardName}</span>}
                  </div>
                  <div className="visa-row">
                    <div className={`visa-field ${cardErrors.cardExpiry ? "has-error" : ""}`}>
                      <label>Expiry</label>
                      <input type="text" inputMode="numeric" placeholder="MM/YY"
                        value={cardExpiry} maxLength={5}
                        onChange={e => { setCardExpiry(formatExpiry(e.target.value)); setCardErrors(p => ({...p, cardExpiry: ""})); }} />
                      {cardErrors.cardExpiry && <span className="field-err">{cardErrors.cardExpiry}</span>}
                    </div>
                    <div className={`visa-field ${cardErrors.cardCvv ? "has-error" : ""}`}>
                      <label>CVV</label>
                      <input type="password" inputMode="numeric" placeholder="•••"
                        value={cardCvv} maxLength={4}
                        onChange={e => { setCardCvv(e.target.value.replace(/\D/g,"")); setCardErrors(p => ({...p, cardCvv: ""})); }} />
                      {cardErrors.cardCvv && <span className="field-err">{cardErrors.cardCvv}</span>}
                    </div>
                  </div>
                </div>

                <div className="visa-secure">
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none"><path d="M8 1L2 3.5v4C2 11 4.667 14 8 15c3.333-1 6-4 6-7.5v-4L8 1z" fill="rgba(52,211,153,0.2)" stroke="#34d399" strokeWidth="1.2"/><path d="M5.5 8l1.8 1.8L10.5 6" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  <span>256-bit SSL encrypted &amp; secure</span>
                </div>
              </div>
            )}

            {/* ── Net Banking Panel ── */}
            {payMethod === "netbanking" && (
              <div className="pm-panel netbank-panel">
                <p className="pm-hint">Choose your bank to proceed with Net Banking.</p>
                <div className="bank-grid">
                  {BANKS.map(bank => (
                    <button
                      key={bank.id}
                      className={`bank-card ${selectedBank === bank.id ? "active" : ""}`}
                      onClick={() => setSelectedBank(bank.id)}
                      style={{ "--bank-color": bank.color }}
                    >
                      <div className="bank-icon">{bank.code.slice(0, 2)}</div>
                      <div className="bank-info">
                        <span className="bank-name">{bank.name}</span>
                        <span className="bank-code">{bank.code}</span>
                      </div>
                      {selectedBank === bank.id && <span className="bank-check">✓</span>}
                    </button>
                  ))}
                </div>
                {selectedBank && (
                  <div className="netbank-selected">
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none"><path d="M8 1L2 3.5v4C2 11 4.667 14 8 15c3.333-1 6-4 6-7.5v-4L8 1z" fill="rgba(96,165,250,0.2)" stroke="#60a5fa" strokeWidth="1.2"/><path d="M5.5 8l1.8 1.8L10.5 6" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    <span>You'll be redirected to your bank's secure portal</span>
                  </div>
                )}
                {!selectedBank && <p className="pm-error pm-error-hint">Select a bank to continue</p>}
              </div>
            )}

            {/* ── Wallet Panel ── */}
            {payMethod === "wallet" && (
              <div className="pm-panel wallet-panel">
                <p className="pm-hint">Select your wallet &amp; pay instantly.</p>
                <div className="wallet-grid">
                  {WALLETS.map(w => (
                    <button
                      key={w.id}
                      className={`wallet-card ${selectedWallet === w.id ? "active" : ""}`}
                      onClick={() => setSelectedWallet(w.id)}
                      style={{ "--wallet-color": w.color }}
                    >
                      <div className="wallet-icon">{w.icon}</div>
                      <span className="wallet-name">{w.name}</span>
                      {selectedWallet === w.id && <span className="wallet-check">✓</span>}
                    </button>
                  ))}
                </div>
                {selectedWallet && (
                  <div className="wallet-phone-section">
                    <label className="wallet-phone-label">Linked mobile number</label>
                    <div className="wallet-phone-row">
                      <span className="wallet-phone-prefix">+91</span>
                      <input
                        type="tel"
                        className="wallet-phone-input"
                        placeholder="9876543210"
                        value={walletPhone}
                        onChange={e => setWalletPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        maxLength={10}
                      />
                    </div>
                  </div>
                )}
                {payMethod === "wallet" && !selectedWallet && <p className="pm-error pm-error-hint">Select a wallet to continue</p>}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT SUMMARY ── */}
        <aside className="checkout-right">
          <div className="summary-card">
            <h3>Order Summary</h3>
            <div className="row"><span>Subtotal ({items.length} items)</span><span>₹{subtotal.toFixed(2)}</span></div>
            {discount > 0 && <div className="row"><span>Discount</span><span className="green">-₹{discount.toFixed(2)}</span></div>}

            {/* GST Breakdown */}
            <div className="gst-section">
              <div className="gst-header">
                <span>GST (12%)</span>
                <span>₹{tax.toFixed(2)}</span>
              </div>
              <div className="gst-detail"><span>CGST @ 6%</span><span>₹{cgst.toFixed(2)}</span></div>
              <div className="gst-detail"><span>SGST @ 6%</span><span>₹{sgst.toFixed(2)}</span></div>
              {igst > 0 && <div className="gst-detail"><span>IGST @ 12%</span><span>₹{igst.toFixed(2)}</span></div>}
            </div>

            <div className="row"><span>Platform Fee (2%)</span><span>₹{platformFee.toFixed(2)}</span></div>
            <div className="summary-divider" />
            <div className="total"><span>Total</span><span>₹{total.toFixed(2)}</span></div>

            <button className="pay-btn" onClick={handlePay} disabled={processing}>
              {processing
                ? <><span className="pay-spinner" />Processing…</>
                : <>Pay ₹{total.toFixed(2)} <span className="pay-arrow">→</span></>
              }
            </button>
            <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
          </div>

          <div className="secure-badges">
            <span>🔒 Secured Payment</span>
            <span>✓ No hidden charges</span>
            <span>📋 GST Invoice</span>
          </div>
        </aside>

      </div>
    </div>
  );
}
