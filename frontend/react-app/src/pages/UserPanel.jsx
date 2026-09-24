import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AdminLayout from '../components/AdminLayout';
import { fetchBooks } from '../services/adminBookService';

export default function UserPanel() {
  const { user } = useAuth();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [author, setAuthor] = useState('all');
  const [availability, setAvailability] = useState('all');
  const [sortBy, setSortBy] = useState('title-asc');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const b = await fetchBooks(1, 50);
        setBooks(Array.isArray(b) ? b : []);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, []);

  const categories = useMemo(() => {
    return [...new Set(
      books
        .map((book) => (book.category?.name || book.category || '').toString().trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));
  }, [books]);

  const authors = useMemo(() => {
    return [...new Set(
      books
        .map((book) => (book.author || '').toString().trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));
  }, [books]);

  const filteredBooks = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = books.filter((book) => {
      const title = (book.title || '').toLowerCase();
      const authorName = (book.author || '').toString();
      const categoryName = (book.category?.name || book.category || '').toString();
      const matchesSearch = !query || title.includes(query) || authorName.toLowerCase().includes(query);
      const matchesCategory = category === 'all' || categoryName === category;
      const matchesAuthor = author === 'all' || authorName === author;
      const isVisible = book.enabled !== false;
      const isInStock = book.inStock !== false;
      const matchesAvailability =
        availability === 'all' ||
        (availability === 'in-stock' && isInStock) ||
        (availability === 'out-of-stock' && !isInStock);
      return matchesSearch && matchesCategory && matchesAuthor && matchesAvailability && isVisible;
    });

    const sorted = [...list];
    if (sortBy === 'title-asc') sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    if (sortBy === 'title-desc') sorted.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
    if (sortBy === 'price-asc') sorted.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    if (sortBy === 'price-desc') sorted.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    return sorted;
  }, [author, availability, books, category, search, sortBy]);

  return (
    <AdminLayout>
      <h2>User Panel</h2>
      <p>Signed in as: {user?.email}</p>
      <h3>Available Books</h3>
      <div className="admin-filters">
        <input
          className="admin-filter-input"
          type="text"
          placeholder="Search by title or author"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="admin-filter-grid">
          <select className="admin-filter-input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All categories</option>
            {categories.map((categoryOption) => (
              <option key={categoryOption} value={categoryOption}>{categoryOption}</option>
            ))}
          </select>
          <select className="admin-filter-input" value={author} onChange={(e) => setAuthor(e.target.value)}>
            <option value="all">All authors</option>
            {authors.map((authorOption) => (
              <option key={authorOption} value={authorOption}>{authorOption}</option>
            ))}
          </select>
          <select className="admin-filter-input" value={availability} onChange={(e) => setAvailability(e.target.value)}>
            <option value="all">All availability</option>
            <option value="in-stock">In stock</option>
            <option value="out-of-stock">Out of stock</option>
          </select>
          <select className="admin-filter-input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="title-asc">Title A-Z</option>
            <option value="title-desc">Title Z-A</option>
            <option value="price-asc">Price Low-High</option>
            <option value="price-desc">Price High-Low</option>
          </select>
        </div>
        <p className="admin-filter-meta">Showing {filteredBooks.length} of {books.length} available books</p>
      </div>
      {loading ? <p>Loading...</p> : (
        <ul>
          {filteredBooks.length === 0 ? <li>No books match your filters.</li> : filteredBooks.map(b => <li key={b._id} style={{ color: b.inStock === false ? '#94a3b8' : 'inherit' }}>{b.title} — {b.author}{b.inStock === false ? ' (Out of Stock)' : ''}</li>)}
        </ul>
      )}
    </AdminLayout>
  );
}
