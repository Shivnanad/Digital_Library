import BookCard from "./BookCard";
import "../styles/books.css";

export default function BookGrid({ books, className = "" }) {
  if (!books || !Array.isArray(books) || books.length === 0) {
    return <p className="no-books">No books to display</p>;
  }

  return (
    <div className={`book-grid ${className}`}>
      {books.map(book => {
        if (!book || !book._id) return null;
        return <BookCard key={book._id} book={book} variant="carousel" className="grid-book-card" />;
      })}
    </div>
  );
}

