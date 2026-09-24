import axios from 'axios';

const API = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';
const API_BASE = API.replace(/\/$/, '');

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const fetchDashboardStats = async () => {
  const res = await axios.get(`${API_BASE}/admin/dashboard`, { headers: getAuthHeaders() });
  const payload = res.data || {};
  return {
    books: payload.totalBooks || 0,
    users: payload.totalUsers || 0,
    orders: payload.totalOrders || 0,
    revenue: payload.revenue || 0,
  };
};
