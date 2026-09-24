// Simple cart service using localStorage and window events for updates
const CART_KEY = "readify_cart";

function readCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to read cart", e);
    return [];
  }
}

function writeCart(items) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("cart:updated", { detail: items }));
  } catch (e) {
    console.error("Failed to write cart", e);
  }
}

export function getCart() {
  return readCart();
}

export function addToCart(book, quantity = 1) {
  const items = readCart();
  const existing = items.find((i) => i._id === book._id);
  if (existing) {
    existing.quantity = Math.min((existing.quantity || 0) + quantity, 99);
  } else {
    items.push({
      _id: book._id,
      title: book.title,
      author: book.author,
      price: book.price || 0,
      coverUrl: book.coverUrl || "/placeholder-book.png",
      quantity: quantity,
    });
  }
  writeCart(items);
  return items;
}

export function removeFromCart(bookId) {
  const items = readCart().filter((i) => i._id !== bookId);
  writeCart(items);
  return items;
}

export function updateQuantity(bookId, quantity) {
  const items = readCart();
  const item = items.find((i) => i._id === bookId);
  if (item) {
    item.quantity = Math.max(1, Math.min(quantity, 99));
    writeCart(items);
  }
  return items;
}

export function clearCart() {
  writeCart([]);
}

export function onCartUpdate(cb) {
  const handler = (e) => cb(e.detail || getCart());
  window.addEventListener("cart:updated", handler);
  return () => window.removeEventListener("cart:updated", handler);
}

export default {
  getCart,
  addToCart,
  removeFromCart,
  updateQuantity,
  clearCart,
  onCartUpdate,
};
