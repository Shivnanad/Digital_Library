const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      required: true,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    userName: {
      type: String,
      required: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    title: {
      type: String,
      default: ""
    },
    text: {
      type: String,
      required: true
    },
    helpful: {
      type: Number,
      default: 0
    },
    notHelpful: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

// One review per user per book
reviewSchema.index({ book: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("Review", reviewSchema);
