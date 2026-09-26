import axios from 'axios';
import { API_BASE as CONFIGURED_API } from '../config/api.js';

const API_BASE = CONFIGURED_API;

const getAuthHeaders = () => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
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
