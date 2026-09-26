import axios from 'axios';
import { API_BASE as CONFIGURED_API } from '../config/api.js';

const API_BASE = CONFIGURED_API;

const getAuthHeaders = () => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const fetchUsers = async () => {
  const res = await axios.get(`${API_BASE}/admin/users`, { headers: getAuthHeaders() });
  const payload = res.data;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.users)) return payload.users;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

export const setUserEnabled = async (id, enabled) => {
  const res = await axios.patch(`${API_BASE}/admin/users/${id}/enable`, { enabled }, { headers: getAuthHeaders() });
  return res.data;
};

export const deleteUser = async (id) => {
  const res = await axios.delete(`${API_BASE}/admin/users/${id}`, { headers: getAuthHeaders() });
  return res.data;
};

export const updateUser = async (id, data) => {
  const res = await axios.put(`${API_BASE}/admin/users/${id}`, data, { headers: getAuthHeaders() });
  return res.data;
};
