import React, { useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { fetchDashboardStats } from '../services/adminDashboardService';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await fetchDashboardStats();
        setStats(data);
        setError('');
      } catch (err) {
        setError(err?.response?.data?.message || 'Failed to fetch dashboard data');
      }
    };
    loadStats();
  }, []);

  return (
    <AdminLayout>
      <h2>Dashboard</h2>
      {error ? <p style={{ color: '#ef4444' }}>{error}</p> : null}
      <div className="admin-stats">
        <div className="stat">Books: {stats ? stats.books : '—'}</div>
        <div className="stat">Users: {stats ? stats.users : '—'}</div>
        <div className="stat">Orders: {stats ? stats.orders : '—'}</div>
        <div className="stat">Revenue: {stats ? stats.revenue : '—'}</div>
      </div>
    </AdminLayout>
  );
}
