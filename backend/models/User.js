const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },

    email: {
      type: String,
      required: true,
      unique: true
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user"
    }
    ,

    password: {
      type: String,
      required: true
    },
    enabled: { type: Boolean, default: true },


    cart: [
      {
        book: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Book"
        },
        quantity: {
          type: Number,
          default: 1
        }
      }
    ],

    purchasedBooks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Book"
      }
    ],

    lastLogin: {
      type: Date,
      default: null
    },

    profilePic: {
      type: String,
      default: null
    },

    onboardingCompleted: {
      type: Boolean,
      default: false
    },

    readingPreferences: {
      favoriteGenres: { type: [String], default: [] },
      readingFrequency: { type: String, default: "" },
      readingGoal: { type: String, default: "" },
      preferredFormat: { type: String, default: "" },
      excitedAbout: { type: String, default: "" }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
