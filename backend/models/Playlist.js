const mongoose = require("mongoose");

const playlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    books: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Book",
      },
    ],
    coverColor: {
      type: String,
      default: "#8b5cf6",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Playlist", playlistSchema);
