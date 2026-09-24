const mongoose = require("mongoose");
require("dotenv").config();

const Book = require("../models/Book");

const db = require("../config/db");

// Example cover URLs mapping - Replace these with actual Google image URLs
const COVER_URLS = {
  "Think and Grow Rich": "https://images.unsplash.com/photo-1507842217343-583f20a0ae18?w=400",
  "The 7 Habits of Highly Effective People": "https://images.unsplash.com/photo-1507842217343-583f20a0ae18?w=400",
  "How to Win Friends and Influence People": "https://images.unsplash.com/photo-1507842217343-583f20a0ae18?w=400",
  "Atomic Habits": "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400",
  "Rich Dad Poor Dad": "https://images.unsplash.com/photo-1516979187457-635ffe35ff15?w=400",
  "The Power of Now": "https://images.unsplash.com/photo-1507842217343-583f20a0ae18?w=400",
  "Man's Search for Meaning": "https://images.unsplash.com/photo-1507842217343-583f20a0ae18?w=400",
  "The Subtle Art of Not Giving a F*ck": "https://images.unsplash.com/photo-1507842217343-583f20a0ae18?w=400",
  "Deep Work": "https://images.unsplash.com/photo-1516979187457-635ffe35ff15?w=400",
  "Start With Why": "https://images.unsplash.com/photo-1507842217343-583f20a0ae18?w=400",
  "The Psychology of Money": "https://images.unsplash.com/photo-1516979187457-635ffe35ff15?w=400",
  "Can't Hurt Me": "https://images.unsplash.com/photo-1507842217343-583f20a0ae18?w=400",
  "The Alchemist": "https://images.unsplash.com/photo-1507842217343-583f20a0ae18?w=400",
  "Ikigai": "https://images.unsplash.com/photo-1516979187457-635ffe35ff15?w=400",
  "Grit": "https://images.unsplash.com/photo-1507842217343-583f20a0ae18?w=400",
  "Mindset": "https://images.unsplash.com/photo-1516979187457-635ffe35ff15?w=400",
  "Awaken the Giant Within": "https://images.unsplash.com/photo-1507842217343-583f20a0ae18?w=400",
  "The Four Agreements": "https://images.unsplash.com/photo-1507842217343-583f20a0ae18?w=400",
  "Meditations": "https://images.unsplash.com/photo-1516979187457-635ffe35ff15?w=400",
  "The Art of War": "https://images.unsplash.com/photo-1507842217343-583f20a0ae18?w=400",
  "The 48 Laws of Power": "https://images.unsplash.com/photo-1516979187457-635ffe35ff15?w=400",
  "The Power of Habit": "https://images.unsplash.com/photo-1507842217343-583f20a0ae18?w=400",
  "Think Like a Monk": "https://images.unsplash.com/photo-1516979187457-635ffe35ff15?w=400",
  "Ego Is the Enemy": "https://images.unsplash.com/photo-1507842217343-583f20a0ae18?w=400",
  "Do Epic Shit": "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400",
};

// Function to generate cover URL by book title
const generateCoverUrl = (title) => {
  // Check if we have a predefined URL for this book
  if (COVER_URLS[title]) {
    return COVER_URLS[title];
  }
  
  // Generate URL from title slug
  const titleSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  
  // Use placeholder book cover service
  return `https://covers.openlibrary.org/b/title/${titleSlug}-M.jpg`;
};

const addCoverUrls = async () => {
  try {
    await db();
    console.log("✓ Connected to MongoDB");

    const books = await Book.find();
    console.log(`Found ${books.length} books to update...`);

    if (books.length === 0) {
      console.log("No books found in database");
      process.exit(0);
    }

    let updated = 0;

    for (const book of books) {
      if (!book.coverUrl) {
        const coverUrl = generateCoverUrl(book.title);
        book.coverUrl = coverUrl;
        await book.save();
        console.log(`✓ Added cover for: ${book.title}`);
        updated++;
      } else {
        console.log(`⚠ Already has cover: ${book.title}`);
      }
    }

    console.log(`\n✅ Successfully added coverUrls to ${updated} books!`);
    console.log("\n📝 Next Step: Replace the example URLs with actual Google image URLs");
    console.log("   You can update individual books in the Admin Panel or use the API.");

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

addCoverUrls();
