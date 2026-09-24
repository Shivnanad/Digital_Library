import React from 'react';
import { NavLink } from 'react-router-dom';

export default function AdminSidebar() {
  return (
    <aside className="admin-sidebar">
      <div className="admin-logo">Admin</div>
      <nav>
        <ul>
          <li><NavLink to="/admin" end>Dashboard</NavLink></li>
          <li><NavLink to="/admin/books">Books</NavLink></li>
          <li><NavLink to="/admin/categories">Categories</NavLink></li>
          <li><NavLink to="/admin/users">Users</NavLink></li>
          <li><NavLink to="/admin/orders">Orders</NavLink></li>
          <li><NavLink to="/admin/reviews">Reviews</NavLink></li>
          <li><NavLink to="/app">Back to site</NavLink></li>
        </ul>
      </nav>
    </aside>
  );
}
