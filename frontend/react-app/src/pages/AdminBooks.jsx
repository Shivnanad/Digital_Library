import React, { useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { fetchBooks, deleteBook, setEnabled, setStockStatus } from '../services/adminBookService';
import { Link } from 'react-router-dom';

export default function AdminBooks() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchBooks(1, 100);
      setBooks(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || 'Failed to fetch books');
      setBooks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this book?')) return;
    await deleteBook(id);
    load();
  };

  const toggleEnable = async (b) => {
    await setEnabled(b._id, !b.enabled);
    load();
  };

  const toggleStock = async (b) => {
    const currentlyInStock = b.inStock !== false;
    await setStockStatus(b._id, !currentlyInStock);
    load();
  };

  return (
    <AdminLayout>
      <div className="admin-books-header">
        <h2>Books</h2>
        <Link to="/admin/books/new" className="btn">Add Book</Link>
      </div>
      {error ? <div style={{ color: '#ef4444', marginBottom: '10px' }}>{error}</div> : null}

      {loading ? <div>Loading...</div> : (
        <table className="admin-table">
          <thead>
            <tr><th>Cover</th><th>Title</th><th>Author</th><th>Category</th><th>Price</th><th>In Stock</th><th>Enabled</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {books.map(b => (
              <tr key={b._id} className={b.inStock === false ? 'admin-row-out' : ''}>
                <td><img src={b.coverUrl || b.pdfUrl} alt="cover" style={{width:60}}/></td>
                <td>{b.title}</td>
                <td>{b.author}</td>
                <td>{b.category?.name}</td>
                <td>{b.buyPrice || b.price}</td>
                <td>{b.inStock === false ? 'No' : 'Yes'}</td>
                <td>{b.enabled ? 'Yes' : 'No'}</td>
                <td>
                  <Link to={`/admin/books/${b._id}`}>Edit</Link>
                  {' | '}
                  <button onClick={() => toggleStock(b)}>{b.inStock === false ? 'Mark In Stock' : 'Mark Out of Stock'}</button>
                  {' | '}
                  <button onClick={() => toggleEnable(b)}>{b.enabled ? 'Disable' : 'Enable'}</button>
                  {' | '}
                  <button onClick={() => handleDelete(b._id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminLayout>
  );
}
