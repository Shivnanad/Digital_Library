import axios from "axios";

import { API_BASE } from "../config/api.js";
const API = `${API_BASE}/auth`;

export const loginUser = async (data) => {
  try {
    const res = await axios.post(`${API}/login`, data);
    localStorage.setItem("token", res.data.token);
    return res.data;
  } catch (err) {
    throw err.response.data.message;
  }
};

export const registerUser = async (data) => {
  try {
    const res = await axios.post(`${API}/register`, data);
    return res.data;
  } catch (err) {
    throw err.response.data.message;
  }
};

export const uploadProfilePic = async (file) => {
  const token = localStorage.getItem("token");
  const formData = new FormData();
  formData.append("profilePic", file);
  const res = await axios.put(`${API}/profile-pic`, formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data",
    },
  });
  return res.data;
};

export const removeProfilePic = async () => {
  const token = localStorage.getItem("token");
  const res = await axios.delete(`${API}/profile-pic`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

export const sendPasswordChangeOtp = async () => {
  const token = localStorage.getItem("token");
  const res = await axios.post(
    `${API}/password-change/send-otp`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
};

export const verifyPasswordChangeOtp = async (otp) => {
  const token = localStorage.getItem("token");
  const res = await axios.post(
    `${API}/password-change/verify-otp`,
    { otp },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
};

export const updatePasswordWithOtp = async (newPassword) => {
  const token = localStorage.getItem("token");
  const res = await axios.post(
    `${API}/password-change/update`,
    { newPassword },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
};

export const completeOnboarding = async () => {
  const token = localStorage.getItem("token");
  const res = await axios.post(
    `${API}/complete-onboarding`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
};

export const savePreferences = async (data) => {
  const token = localStorage.getItem("token");
  const res = await axios.post(
    `${API}/save-preferences`,
    data,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
};
