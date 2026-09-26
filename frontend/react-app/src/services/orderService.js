import { API_BASE, BACKEND_URL } from "../config/api.js";
const API = API_BASE;
const BACKEND = BACKEND_URL;

const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token") || sessionStorage.getItem("token")}`,
});

/** Safe fetch wrapper with timeout and error handling */
async function safeFetch(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || 15000);
  
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw err;
  }
}

/** Safe JSON parsing — won't crash on non-JSON responses */
async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

/* Record a purchase — call after successful payment */
export async function purchaseBooks(bookIds, orderData = {}) {
  const res = await safeFetch(`${API}/orders/purchase`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ bookIds, ...orderData }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.message || "Purchase record failed");
  return data;
}

/* Get all purchased books for the logged-in user */
export async function getPurchasedBooks() {
  const res = await safeFetch(`${API}/orders/purchased`, {
    headers: authHeaders(),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.message || "Failed to fetch purchases");
  // Normalize coverUrl — prepend backend host for local paths
  return (data.purchasedBooks || []).map(book => {
    let coverUrl = book.coverUrl || book.cover || "";
    if (coverUrl && coverUrl.startsWith("/covers/")) {
      coverUrl = `${BACKEND}${coverUrl}`;
    }
    return { ...book, coverUrl };
  });
}

/* Check if a single book is purchased */
export async function checkBookPurchased(bookId) {
  try {
    const res = await safeFetch(`${API}/orders/purchased/${bookId}`, {
      headers: authHeaders(),
    });
    const data = await safeJson(res);
    if (!res.ok) return false;
    return data.purchased === true;
  } catch {
    return false;
  }
}

/* Get all orders for the logged-in user */
export async function getMyOrders() {
  const res = await safeFetch(`${API}/orders/my-orders`, {
    headers: authHeaders(),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.message || "Failed to fetch orders");
  // Normalize coverUrl in order items
  return (data.orders || []).map(order => ({
    ...order,
    items: (order.items || []).map(item => {
      let coverUrl = item.coverUrl || item.cover || "";
      if (coverUrl && coverUrl.startsWith("/covers/")) coverUrl = `${BACKEND}${coverUrl}`;
      return { ...item, coverUrl };
    }),
  }));
}

/* Get invoice data for a specific order */
export async function getInvoice(orderId) {
  const res = await safeFetch(`${API}/orders/${orderId}/invoice`, {
    headers: authHeaders(),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.message || "Failed to fetch invoice");
  return data;
}

/* Resend invoice email */
export async function resendInvoiceEmail(orderId) {
  const res = await safeFetch(`${API}/orders/${orderId}/resend-email`, {
    method: "POST",
    headers: authHeaders(),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.message || "Failed to resend email");
  return data;
}

/* Download invoice PDF as Blob */
export async function downloadInvoicePDF(orderId) {
  const res = await safeFetch(`${API}/orders/${orderId}/invoice/pdf`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token") || sessionStorage.getItem("token")}`,
    },
    timeout: 30000,
  });
  if (!res.ok) {
    const data = await safeJson(res);
    throw new Error(data.message || "Failed to download PDF");
  }
  return await res.blob();
}

/* Cancel/refund a purchased book from a specific order */
export async function cancelOrderItem(orderId, bookId, reason, refundMethod, refundDetails = {}) {
  const res = await safeFetch(`${API}/orders/${orderId}/items/${bookId}/cancel`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ reason, refundMethod, refundDetails }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.message || "Failed to cancel purchased book");
  return data;
}
