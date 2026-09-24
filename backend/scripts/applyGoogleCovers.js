const mongoose = require("mongoose");
require("dotenv").config();
const Book = require("../models/Book");
const db = require("../config/db");
const fs = require("fs");
const path = require("path");

/**
 * Script to apply cover URLs from googleCovers.json to database
 * Run this after you've filled in the image URLs
 */

const applyGoogleCovers = async () => {
  try {
    await db();
    console.log("✓ Connected to MongoDB\n");

    const filePath = path.join(__dirname, "../seed/googleCovers.json");

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log("❌ googleCovers.json not found!");
      console.log("Run: npm run generate-covers");
      process.exit(1);
    }

    const coversData = JSON.parse(fs.readFileSync(filePath, "utf8"));
    console.log(`Loading covers from googleCovers.json...\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const [bookId, coverInfo] of Object.entries(coversData)) {
      try {
        // Skip if placeholder URL
        if (coverInfo.coverUrl === "PASTE_YOUR_GOOGLE_IMAGE_URL_HERE") {
          console.log(`⏭️  Skipped (no URL): ${coverInfo.title}`);
          skipped++;
          continue;
        }

        // Check if URL is valid
        if (!coverInfo.coverUrl || !coverInfo.coverUrl.startsWith("http")) {
          console.log(`⚠️  Invalid URL for: ${coverInfo.title}`);
          skipped++;
          continue;
        }

        // First try to find by ID, then by title
        let result = await Book.findByIdAndUpdate(
          bookId,
          { coverUrl: coverInfo.coverUrl },
          { new: true }
        );

        // If not found by ID, search by title
        if (!result) {
          result = await Book.findOneAndUpdate(
            { title: coverInfo.title },
            { coverUrl: coverInfo.coverUrl },
            { new: true }
          );
        }

        if (result) {
          console.log(`✓ Updated: ${coverInfo.title}`);
          updated++;
        } else {
          console.log(`❌ Not found: ${coverInfo.title}`);
          errors++;
        }
      } catch (err) {
        console.log(`❌ Error updating ${coverInfo.title}: ${err.message}`);
        errors++;
      }
    }

    console.log(`\n${"=".repeat(50)}`);
    console.log(`✅ Updated: ${updated} books`);
    console.log(`⏭️  Skipped: ${skipped} books (no URL or placeholder)`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`${"=".repeat(50)}\n`);

    if (updated === 0) {
      console.log("💡 Tip: Please fill in the URLs in googleCovers.json first!");
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
};

applyGoogleCovers();
