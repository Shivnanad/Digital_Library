const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Book = require("../models/Book");
const books = require("./books.json");

dotenv.config();

mongoose.connect(process.env.MONGO_URI);

const seedBooks = async () => {
  try {
    await Book.deleteMany(); // optional: clears old data

    const seededBooks = books.map((book) => ({
      ...book,
      pdfUrl: `${process.env.PDF_BASE_URL}/${book.pdfFile}`
    }));

    await Book.insertMany(seededBooks);

    console.log("✅ Books seeded successfully");
    process.exit();
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
};

seedBooks();
