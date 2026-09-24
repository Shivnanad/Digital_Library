import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function AdminTopbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="admin-topbar">
      <div className="topbar-left">Admin Panel</div>
      <div className="topbar-right">
        <span>{user ? user.name : 'Admin'}</span>
        <button onClick={handleLogout}>Logout</button>
      </div>
    </header>
  );
}
