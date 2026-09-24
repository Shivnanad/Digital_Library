import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getCart, removeFromCart, clearCart } from "../services/cartService";
import "../styles/cart.css";

export default function Cart() {
  const [items, setItems] = useState([]);
  const [removing, setRemoving] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    setItems(getCart());
    const handler = (e) => setItems(e.detail || getCart());
    window.addEventListener("cart:updated", handler);
    return () => window.removeEventListener("cart:updated", handler);
  }, []);

  const handleRemove = (id) => {
    setRemoving(id);
    setTimeout(() => {
      removeFromCart(id);
      setRemoving(null);
    }, 320);
  };

  const subtotal = items.reduce((s, it) => s + Number(it.price || 0), 0);
  const count = items.length;

  if (!items || items.length === 0) {
    return (
      <div className="cart-page">
        <div className="cart-empty">
          <div className="cart-empty-icon">
            <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" opacity="0.3"/>
              <path d="M20 22h24l-3 14H23L20 22z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M16 18h3l1 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="26" cy="40" r="2" fill="currentColor"/>
              <circle cx="38" cy="40" r="2" fill="currentColor"/>
            </svg>
          </div>
          <h2>Your cart is empty</h2>
          <p>Looks like you haven't added any books yet. Start exploring!</p>
          <Link to="/app" className="cart-browse-btn">Browse Books</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <div className="cart-header">
        <div>
          <h1 className="cart-heading">Shopping Cart</h1>
          <p className="cart-subheading">{count} {count === 1 ? "item" : "items"} in your cart</p>
        </div>
      </div>

      <div className="cart-layout">
        {/* Items column */}
        <div className="cart-items-col">
          {items.map((it) => (
            <div
              key={it._id}
              className={`cart-card${removing === it._id ? " cart-card--removing" : ""}`}
            >
              <div className="cart-card-cover">
                <img src={it.coverUrl} alt={it.title} />
              </div>
              <div className="cart-card-body">
                <div className="cart-card-info">
                  <h3 className="cart-card-title">{it.title}</h3>
                  <p className="cart-card-author">by {it.author}</p>
                  {it.category?.name && (
                    <span className="cart-card-badge">{it.category.name}</span>
                  )}
                </div>
                <div className="cart-card-footer">
                  <span className="cart-card-price">₹{it.price || 0}</span>
                  <button
                    className="cart-remove-btn"
                    onClick={() => handleRemove(it._id)}
                    aria-label="Remove item"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
                    </svg>
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}

          <button className="cart-clear-btn" onClick={() => { clearCart(); navigate("/app"); }}>
            Clear Cart
          </button>
        </div>

        {/* Summary column */}
        <aside className="cart-summary">
          <div className="cart-summary-inner">
            <h3 className="cart-summary-title">Order Summary</h3>

            <div className="cart-summary-items">
              {items.map((it) => (
                <div key={it._id} className="cart-summary-line">
                  <span className="cart-summary-line-title">{it.title}</span>
                  <span className="cart-summary-line-price">₹{it.price || 0}</span>
                </div>
              ))}
            </div>

            <div className="cart-summary-divider" />

            <div className="cart-summary-row">
              <span>Subtotal</span>
              <span>₹{subtotal}</span>
            </div>

            <div className="cart-summary-divider" />

            <div className="cart-summary-total">
              <span>Total</span>
              <span>₹{subtotal}</span>
            </div>

            <button className="cart-checkout-btn" onClick={() => navigate("/checkout")}>
              Proceed to Checkout
              <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"/>
              </svg>
            </button>

            <Link to="/app" className="cart-continue-link">← Continue Shopping</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
