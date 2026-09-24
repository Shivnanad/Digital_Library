import React, { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { fetchBooks, deleteBook, setEnabled, setStockStatus } from '../services/adminBookService';
import { fetchUsers, setUserEnabled, deleteUser, updateUser } from '../services/adminUserService';
import { useNavigate } from 'react-router-dom';

export default function AdminPanel() {
  const [books, setBooks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bookSearch, setBookSearch] = useState('');
  const [bookCategory, setBookCategory] = useState('all');
  const [bookStatus, setBookStatus] = useState('all');
  const [bookAvailability, setBookAvailability] = useState('all');
  const [userSearch, setUserSearch] = useState('');
  const [userRole, setUserRole] = useState('all');
  const [userStatus, setUserStatus] = useState('all');
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const b = await fetchBooks(1, 200);
      setBooks(Array.isArray(b) ? b : []);
      const u = await fetchUsers();
      setUsers(Array.isArray(u) ? u : []);
      setError('');
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || 'Failed to fetch admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDeleteBook = async (id) => {
    if (!window.confirm('Delete book?')) return;
    await deleteBook(id);
    load();
  };

  const toggleEnableBook = async (b) => {
    const currentEnabled = b.enabled !== false;
    await setEnabled(b._id, !currentEnabled);
    load();
  };

  const toggleStockBook = async (b) => {
    const currentlyInStock = b.inStock !== false;
    await setStockStatus(b._id, !currentlyInStock);
    load();
  };

  const toggleEnableUser = async (u) => {
    const currentEnabled = u.enabled !== false;
    await setUserEnabled(u._id, !currentEnabled);
    load();
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Delete user?')) return;
    await deleteUser(id);
    load();
  };

  const handleEditUser = async (u) => {
    const name = window.prompt('Name', u.name || '');
    if (name === null) return;
    const email = window.prompt('Email', u.email || '');
    if (email === null) return;
    const role = window.prompt('Role (admin/user)', u.role || 'user');
    if (role === null) return;

    await updateUser(u._id, { name: name.trim(), email: email.trim(), role: role.trim() });
    load();
  };

  const bookCategories = useMemo(() => {
    return [...new Set(
      books
        .map((book) => (book.category?.name || book.category || '').toString().trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));
  }, [books]);

  const filteredBooks = useMemo(() => {
    const query = bookSearch.trim().toLowerCase();
    return books.filter((book) => {
      const title = (book.title || '').toLowerCase();
      const author = (book.author || '').toLowerCase();
      const category = (book.category?.name || book.category || '').toString();
      const isEnabled = book.enabled !== false;
      const inStock = book.inStock !== false;

      const matchesSearch = !query || title.includes(query) || author.includes(query);
      const matchesCategory = bookCategory === 'all' || category === bookCategory;
      const matchesStatus =
        bookStatus === 'all' ||
        (bookStatus === 'enabled' && isEnabled) ||
        (bookStatus === 'disabled' && !isEnabled);

      const matchesAvailability =
        bookAvailability === 'all' ||
        (bookAvailability === 'in-stock' && inStock) ||
        (bookAvailability === 'out-of-stock' && !inStock);

      return matchesSearch && matchesCategory && matchesStatus && matchesAvailability;
    });
  }, [books, bookAvailability, bookCategory, bookSearch, bookStatus]);

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    return users.filter((user) => {
      const name = (user.name || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      const role = (user.role || 'user').toLowerCase();
      const isEnabled = user.enabled !== false;

      const matchesSearch = !query || name.includes(query) || email.includes(query);
      const matchesRole = userRole === 'all' || role === userRole;
      const matchesStatus =
        userStatus === 'all' ||
        (userStatus === 'enabled' && isEnabled) ||
        (userStatus === 'disabled' && !isEnabled);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [userRole, userSearch, userStatus, users]);

  return (
    <AdminLayout>
      <h2>Admin Panel</h2>
      {error ? <p style={{ color: '#ef4444' }}>{error}</p> : null}
      <div style={{display: 'flex', gap: 20}}>
        <section style={{flex:1}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <h3>Books</h3>
            <button onClick={() => navigate('/admin/books/new')}>Add Book</button>
          </div>
          <div className="admin-filters">
            <input
              className="admin-filter-input"
              type="text"
              placeholder="Search by title or author"
              value={bookSearch}
              onChange={(e) => setBookSearch(e.target.value)}
            />
            <div className="admin-filter-grid">
              <select className="admin-filter-input" value={bookCategory} onChange={(e) => setBookCategory(e.target.value)}>
                <option value="all">All categories</option>
                {bookCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <select className="admin-filter-input" value={bookStatus} onChange={(e) => setBookStatus(e.target.value)}>
                <option value="all">All status</option>
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
              </select>
              <select className="admin-filter-input" value={bookAvailability} onChange={(e) => setBookAvailability(e.target.value)}>
                <option value="all">All availability</option>
                <option value="in-stock">In stock</option>
                <option value="out-of-stock">Out of stock</option>
              </select>
            </div>
            <p className="admin-filter-meta">Showing {filteredBooks.length} of {books.length} books</p>
          </div>
          {loading ? <p>Loading...</p> : (
            <table className="admin-table">
              <thead><tr><th>Title</th><th>Author</th><th>Category</th><th>In Stock</th><th>Enabled</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredBooks.length === 0 ? (
                  <tr><td colSpan="6">No books match the selected filters.</td></tr>
                ) : filteredBooks.map(b => (
                  <tr key={b._id} className={b.inStock === false ? 'admin-row-out' : ''}>
                    <td>{b.title}</td>
                    <td>{b.author}</td>
                    <td>{b.category?.name}</td>
                    <td>{b.inStock !== false ? 'Yes' : 'No'}</td>
                    <td>{b.enabled !== false ? 'Yes' : 'No'}</td>
                    <td>
                      <button onClick={() => navigate(`/admin/books/${b._id}`)}>Edit</button>
                      {' '}
                      <button onClick={() => toggleStockBook(b)}>{b.inStock !== false ? 'Mark Out of Stock' : 'Mark In Stock'}</button>
                      {' '}
                      <button onClick={() => toggleEnableBook(b)}>{b.enabled !== false ? 'Disable' : 'Enable'}</button>
                      {' '}
                      <button onClick={() => handleDeleteBook(b._id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section style={{flex:1}}>
          <h3>Users</h3>
          <div className="admin-filters">
            <input
              className="admin-filter-input"
              type="text"
              placeholder="Search by name or email"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
            <div className="admin-filter-grid">
              <select className="admin-filter-input" value={userRole} onChange={(e) => setUserRole(e.target.value)}>
                <option value="all">All roles</option>
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
              <select className="admin-filter-input" value={userStatus} onChange={(e) => setUserStatus(e.target.value)}>
                <option value="all">All status</option>
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
            <p className="admin-filter-meta">Showing {filteredUsers.length} of {users.length} users</p>
          </div>
          {loading ? <p>Loading...</p> : (
            <table className="admin-table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Enabled</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr><td colSpan="5">No users match the selected filters.</td></tr>
                ) : filteredUsers.map(u => (
                  <tr key={u._id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.role || 'user'}</td>
                    <td>{u.enabled !== false ? 'Yes' : 'No'}</td>
                    <td>
                      <button onClick={() => toggleEnableUser(u)}>{u.enabled !== false ? 'Disable' : 'Enable'}</button>
                      {' '}
                      <button onClick={() => handleEditUser(u)}>Edit</button>
                      {' '}
                      <button onClick={() => handleDeleteUser(u._id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
