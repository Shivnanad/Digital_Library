const express = require("express");
const router = express.Router();
const { requireAdmin, requireAuth } = require("../middlewares/authMiddleware");

const {
  addBook,
  getAllBooks,
  getBooksByCategory,
  searchBooks,
  getBookById,
  updateBook,
  deleteBook,
  setBookEnabled,
  setBookFlags
} = require("../controllers/bookController");

const { getReviews, addReview, voteReview } = require("../controllers/reviewController");



// add book (admin)
router.post("/", requireAdmin, addBook);

// get all books
router.get("/", getAllBooks);

// search books (must come BEFORE /:id route)
router.get("/search", searchBooks);

// get books by category
router.get("/category/:categoryId", getBooksByCategory);

// admin: update book
router.put("/:id", requireAdmin, updateBook);

// admin: delete book
router.delete("/:id", requireAdmin, deleteBook);

// admin: enable/disable
router.patch("/:id/enable", requireAdmin, setBookEnabled);

// admin: set feature flags
router.patch("/:id/flags", requireAdmin, setBookFlags);

// get book by id (must come LAST)
router.get("/:id", getBookById);

// ── Reviews ─────────────────────────────────────────
// GET all reviews for a book
router.get("/:bookId/reviews", getReviews);
// POST add a review (auth required)
router.post("/:bookId/reviews", requireAuth, addReview);
// PATCH vote helpful/notHelpful on a review
router.patch("/reviews/:reviewId/vote", voteReview);

module.exports = router;


