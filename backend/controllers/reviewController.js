const Review = require("../models/Review");

// GET reviews for a book
const getReviews = async (req, res) => {
  try {
    const { bookId } = req.params;
    const reviews = await Review.find({ book: bookId })
      .sort({ createdAt: -1 });

    const total = reviews.length;
    const avgRating = total > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / total).toFixed(1)
      : 0;

    // Build rating breakdown
    const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach(r => breakdown[r.rating]++);

    res.json({ reviews, total, avgRating: parseFloat(avgRating), breakdown });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ADD a review (auth required)
const addReview = async (req, res) => {
  try {
    const { bookId } = req.params;
    const { rating, title, text } = req.body;

    if (!rating || !text) {
      return res.status(400).json({ message: "Rating and review text are required." });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5." });
    }

    // Check if user already reviewed this book
    const existing = await Review.findOne({ book: bookId, user: req.user._id });
    if (existing) {
      return res.status(409).json({ message: "You have already reviewed this book." });
    }

    const review = await Review.create({
      book: bookId,
      user: req.user._id,
      userName: req.user.name,
      rating: Number(rating),
      title: title || "",
      text
    });

    res.status(201).json({ review });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "You have already reviewed this book." });
    }
    res.status(500).json({ message: err.message });
  }
};

// VOTE helpful/notHelpful — supports add, undo (same button), and switch
const voteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { vote, prevVote } = req.body; // vote: target, prevVote: what user had before (or null)

    if (!vote || !["helpful", "notHelpful"].includes(vote)) {
      return res.status(400).json({ message: "Invalid vote type." });
    }

    let update = {};

    if (!prevVote) {
      // Fresh vote — just increment
      update = { $inc: { [vote]: 1 } };
    } else if (prevVote === vote) {
      // Same button clicked again — undo (decrement, floor at 0)
      const review = await Review.findById(reviewId);
      if (!review) return res.status(404).json({ message: "Review not found." });
      update = { $set: { [vote]: Math.max(0, (review[vote] || 0) - 1) } };
    } else {
      // Switched to opposite — decrement old, increment new
      const review = await Review.findById(reviewId);
      if (!review) return res.status(404).json({ message: "Review not found." });
      update = {
        $set: {
          [prevVote]: Math.max(0, (review[prevVote] || 0) - 1),
          [vote]: (review[vote] || 0) + 1
        }
      };
    }

    const updated = await Review.findByIdAndUpdate(reviewId, update, { new: true });
    if (!updated) return res.status(404).json({ message: "Review not found." });
    res.json({ helpful: updated.helpful, notHelpful: updated.notHelpful });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getReviews, addReview, voteReview };
