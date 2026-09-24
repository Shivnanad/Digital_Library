import React, { useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { fetchBook, createBook, updateBook } from '../services/adminBookService';
import { useParams, useNavigate } from 'react-router-dom';

export default function AdminBookEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState({ title: '', author: '', category: '', description: '', language: '', pages: '', publishYear: '', rentPrice: '', buyPrice: '', rating: 0, coverUrl: '', pdfUrl: '', inStock: true });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id && id !== 'new') {
      fetchBook(id).then(b => setBook({ ...b, inStock: b?.inStock !== false }));
    }
  }, [id]);

  const handleChange = e => setBook({ ...book, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...book,
        inStock: book.inStock === true || book.inStock === 'true'
      };
      if (id === 'new') {
        await createBook(payload);
      } else {
        await updateBook(id, payload);
      }
      navigate('/admin/books');
    } catch (err) {
      console.error(err);
      alert('Save failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <h2>{id === 'new' ? 'Add Book' : 'Edit Book'}</h2>
      <form onSubmit={handleSubmit} className="admin-form">
        <label>Title<input name="title" value={book.title} onChange={handleChange} required/></label>
        <label>Author<input name="author" value={book.author} onChange={handleChange} required/></label>
        <label>Category<input name="category" value={book.category} onChange={handleChange} required/></label>
        <label>Description<textarea name="description" value={book.description} onChange={handleChange}/></label>
        <label>Language<input name="language" value={book.language} onChange={handleChange}/></label>
        <label>Pages<input name="pages" value={book.pages} onChange={handleChange}/></label>
        <label>Publish Year<input name="publishYear" value={book.publishYear} onChange={handleChange}/></label>
        <label>Rent Price<input name="rentPrice" value={book.rentPrice} onChange={handleChange}/></label>
        <label>Buy Price<input name="buyPrice" value={book.buyPrice} onChange={handleChange}/></label>
        <label>
          Stock Status
          <select name="inStock" value={String(book.inStock !== false)} onChange={handleChange}>
            <option value="true">In Stock</option>
            <option value="false">Out of Stock</option>
          </select>
        </label>
        <label>Rating<input name="rating" value={book.rating} onChange={handleChange} type="number" min="0" max="5" step="0.1"/></label>
        <label>Cover URL<input name="coverUrl" value={book.coverUrl} onChange={handleChange}/></label>
        <label>PDF URL<input name="pdfUrl" value={book.pdfUrl} onChange={handleChange} required/></label>
        <div className="form-actions">
          <button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={() => navigate('/admin/books')}>Cancel</button>
        </div>
      </form>
    </AdminLayout>
  );
}
