import React from 'react';
import AdminSidebar from './AdminSidebar';
import AdminTopbar from './AdminTopbar';
import '../styles/admin.css';

export default function AdminLayout({ children }) {
  return (
    <div className="admin-root">
      <AdminSidebar />
      <div className="admin-main">
        <AdminTopbar />
        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}
