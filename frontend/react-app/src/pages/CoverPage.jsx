import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { fetchBookById } from "../services/bookService";
import "../styles/coverPage.css";

export default function CoverPage() {
  const { id } = useParams();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const b = await fetchBookById(id);
        if (mounted) setBook(b);
      } catch (err) {
        console.error(err);
        if (mounted) setError("Unable to load cover");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [id]);

  if (loading) return <div className="cover-page loading">Loading cover…</div>;
  if (error || !book) return <div className="cover-page error">{error || 'Cover not found'}</div>;

  return (
    <div className="cover-page">
      <div className="cover-backdrop" style={{ backgroundImage: `url(${book.coverUrl})` }} />

      <div className="cover-card">
        <img src={book.coverUrl} alt={book.title} className="cover-image" />

        <div className="cover-info">
          <h1 className="cover-title">{book.title}</h1>
          <p className="cover-author">by {book.author}</p>

          <div className="cover-actions">
            <Link to={`/book/${book._id}`} className="btn btn-outline">View details</Link>
            <button className="btn btn-primary" onClick={() => navigate(`/book/${book._id}`)}>Read now</button>
          </div>
        </div>
      </div>
    </div>
  );
}
