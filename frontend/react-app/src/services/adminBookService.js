import axios from 'axios';

const API = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';
const API_BASE = API.replace(/\/$/, '');

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const fetchBooks = async (page = 1, limit = 20) => {
  const res = await axios.get(`${API_BASE}/admin/books?page=${page}&limit=${limit}`, { headers: getAuthHeaders() });
  const payload = res.data;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.books)) return payload.books;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

export const fetchBook = async (id) => {
  const res = await axios.get(`${API_BASE}/books/${id}`);
  return res.data;
};

export const createBook = async (data) => {
  const res = await axios.post(`${API_BASE}/admin/books`, data, { headers: getAuthHeaders() });
  return res.data;
};

export const updateBook = async (id, data) => {
  const res = await axios.put(`${API_BASE}/books/${id}`, data, { headers: getAuthHeaders() });
  return res.data;
};

export const deleteBook = async (id) => {
  const res = await axios.delete(`${API_BASE}/admin/books/${id}`, { headers: getAuthHeaders() });
  return res.data;
};

export const setEnabled = async (id, enabled) => {
  const res = await axios.patch(`${API_BASE}/books/${id}/enable`, { enabled }, { headers: getAuthHeaders() });
  return res.data;
};

export const setFlags = async (id, flags) => {
  const res = await axios.patch(`${API_BASE}/books/${id}/flags`, flags, { headers: getAuthHeaders() });
  return res.data;
};

export const setStockStatus = async (id, inStock) => {
  const res = await axios.put(`${API_BASE}/books/${id}`, { inStock }, { headers: getAuthHeaders() });
  return res.data;
};
