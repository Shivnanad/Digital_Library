import { API_BASE } from "../config/api.js";
const API = `${API_BASE}/playlists`;

function authHeaders() {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(url, options = {}) {
  const res = await fetch(url, { headers: authHeaders(), ...options });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

export const getPlaylists = () => request(API);

export const createPlaylist = (name, description = "", coverColor = "#8b5cf6") =>
  request(API, {
    method: "POST",
    body: JSON.stringify({ name, description, coverColor }),
  });

export const updatePlaylist = (id, fields) =>
  request(`${API}/${id}`, { method: "PUT", body: JSON.stringify(fields) });

export const deletePlaylist = (id) =>
  request(`${API}/${id}`, { method: "DELETE" });

export const addBookToPlaylist = (playlistId, bookId) =>
  request(`${API}/${playlistId}/books/${bookId}`, { method: "POST" });

export const removeBookFromPlaylist = (playlistId, bookId) =>
  request(`${API}/${playlistId}/books/${bookId}`, { method: "DELETE" });
