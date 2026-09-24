const mongoose = require("mongoose");
require("dotenv").config();
const Book = require("../models/Book");
const db = require("../config/db");
const fs = require("fs");
const path = require("path");

/**
 * Script to generate a cover URL mapping template
 * This creates a googleCovers.json file where you can add your own image URLs
 */

const generateGoogleCoversTemplate = async () => {
  try {
    await db();
    console.log("✓ Connected to MongoDB\n");

    const books = await Book.find().select("_id title author price");
    console.log(`Found ${books.length} books\n`);

    if (books.length === 0) {
      console.log("No books found in database");
      process.exit(0);
    }

    // Create mapping object
    const coversMap = {};
    books.forEach((book) => {
      coversMap[book._id] = {
        title: book.title,
        author: book.author,
        price: book.price,
        coverUrl: "PASTE_YOUR_GOOGLE_IMAGE_URL_HERE"
      };
    });

    // Save to file
    const filePath = path.join(__dirname, "../seed/googleCovers.json");
    fs.writeFileSync(filePath, JSON.stringify(coversMap, null, 2));

    console.log(`✅ Created: ${filePath}`);
    console.log(`\n📝 Instructions:`);
    console.log("1. Open googleCovers.json");
    console.log("2. Replace 'PASTE_YOUR_GOOGLE_IMAGE_URL_HERE' with actual Google image URLs");
    console.log("3. Run: npm run apply-covers");
    console.log("\n💡 Tips for getting image URLs:");
    console.log("   - Search on Google Images");
    console.log("   - Right-click → Copy image link");
    console.log("   - Test URL works in browser before pasting");
    console.log("\n📚 Sample books ready for URLs:");

    // Show first 5 books as preview
    books.slice(0, 5).forEach((book) => {
      console.log(`   - ${book.title} by ${book.author}`);
    });
    console.log(`   ... and ${books.length - 5} more books\n`);

    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
};

generateGoogleCoversTemplate();
