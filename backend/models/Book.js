const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true
    },

    author: {
      type: String,
      required: true
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true
    },

    price: {
      type: Number,
      default: 0
    },
    rentPrice: { type: Number, default: 0 },
    buyPrice: { type: Number, default: 0 },
    language: { type: String },
    pages: { type: Number },
    publishYear: { type: Number },
    rating: { type: Number, default: 0 },
    coverUrl: { type: String },
    inStock: { type: Boolean, default: true },
    enabled: { type: Boolean, default: true },
    trending: { type: Boolean, default: false },
    featured: { type: Boolean, default: false },
    newRelease: { type: Boolean, default: false },
    views: { type: Number, default: 0 },

    description: {
      type: String
    },

    pdfUrl: {
      type: String,
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Book", bookSchema);
