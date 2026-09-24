/**
 * This script:
 * 1. Fixes the typo book "the opstsele is the way" → "The Obstacle Is the Way"
 * 2. Fixes all 50 existing books' broken category references
 * 3. Adds 30 missing books from googleCovers.json
 * 4. Applies coverUrls from googleCovers.json to ALL books (by title match)
 */

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Book = require("../models/Book");
const Category = require("../models/Category");
const covers = require("../seed/googleCovers.json");

dotenv.config();

// Category mapping by book title keywords
const categoryMap = {
  "Motivation": [
    "Think and Grow Rich", "Start With Why", "Can't Hurt Me", "Grit",
    "Awaken the Giant Within", "Do Epic Shit", "Who Will Cry When You Die",
    "The Monk Who Sold His Ferrari", "The Secret", "Drive",
    "The Richest Man in Babylon", "You Can Win", "The 5 AM Club",
    "Life Is What You Make It", "The Book of Joy", "Man's Search for Meaning",
    "Make Your Bed", "The Happiness Advantage", "The Courage To Be Disliked",
    "The Courage to be Happy", "Unfuck Yourself", "Life's Amazing Secrets",
    "Start Now Get Perfect Later", "Mindset Secrets for Winning",
    "The Law of Attraction", "The Success Principles", "The Comfort Crisis",
    "Rich Dad Poor Dad", "The Power of Positive Thinking", "Psychology of Success",
    "The Magic of Thinking Big"
  ],
  "Focus & Productivity": [
    "Deep Work", "Eat That Frog", "Essentialism", "The ONE Thing",
    "Rework", "The Power of Habit", "Atomic Habits", "Limitless",
    "The Compound Effect", "The Miracle Morning", "Tools of Titans",
    "Think Faster, Talk Smarter", "Atomic Focus", "Zero to One",
    "The Personal MBA", "The 48 Laws of Power"
  ],
  "Self Improvement": [
    "As a Man Thinketh", "The 7 Habits of Highly Effective People",
    "How to Win Friends and Influence People", "Mindset",
    "The Subtle Art of Not Giving a F*ck", "Steal Like an Artist",
    "Stillness is the Key", "The Almanack of Naval Ravikant",
    "The Art of Thinking Clearly", "The Mountain Is You",
    "The Obstacle Is the Way", "The Power of Now", "The Daily Stoic",
    "The Psychology of Money", "Think Straight", "Outliers",
    "Mastery", "Educated", "The Alchemist", "Ikigai",
    "The Four Agreements", "Meditations", "The Art of War",
    "Think Like a Monk", "Ego Is the Enemy", "Rewire Your Brain",
    "The Intelligent Investor", "Flow"
  ],
  "Space & Tech": [
    "Homo Deus", "Sapiens", "A Brief History of Time",
    "The Alchemist's Companion"
  ]
};

// Missing 30 books with best-guess pdfFile (empty string if no PDF available)
const missingBooks = [
  { title: "Think and Grow Rich", author: "Napoleon Hill", price: 320, description: "Think and Grow Rich by Napoleon Hill", pdfFile: "" },
  { title: "Start With Why", author: "Simon Sinek", price: 171, description: "Start With Why by Simon Sinek", pdfFile: "" },
  { title: "Can\u2019t Hurt Me", author: "David Goggins", price: 248, description: "Can\u2019t Hurt Me by David Goggins", pdfFile: "" },
  { title: "Ikigai", author: "H\u00e9ctor Garc\u00eda and Francesc Miralles", price: 339, description: "Ikigai by H\u00e9ctor Garc\u00eda and Francesc Miralles", pdfFile: "" },
  { title: "Grit", author: "Angela Duckworth", price: 289, description: "Grit by Angela Duckworth", pdfFile: "" },
  { title: "Awaken the Giant Within", author: "Tony Robbins", price: 422, description: "Awaken the Giant Within by Tony Robbins", pdfFile: "" },
  { title: "The Four Agreements", author: "Don Miguel Ruiz", price: 191, description: "The Four Agreements by Don Miguel Ruiz", pdfFile: "" },
  { title: "Meditations", author: "Marcus Aurelius", price: 302, description: "Meditations by Marcus Aurelius", pdfFile: "" },
  { title: "The Art of War", author: "Sun Tzu", price: 318, description: "The Art of War by Sun Tzu", pdfFile: "" },
  { title: "The Power of Habit", author: "Charles Duhigg", price: 456, description: "The Power of Habit by Charles Duhigg", pdfFile: "" },
  { title: "Think Like a Monk", author: "Jay Shetty", price: 476, description: "Think Like a Monk by Jay Shetty", pdfFile: "" },
  { title: "Ego Is the Enemy", author: "Ryan Holiday", price: 475, description: "Ego Is the Enemy by Ryan Holiday", pdfFile: "" },
  { title: "Do Epic Shit", author: "Ankur Warikoo", price: 495, description: "Do Epic Shit by Ankur Warikoo", pdfFile: "" },
  { title: "Who Will Cry When You Die", author: "Robin Sharma", price: 341, description: "Who Will Cry When You Die by Robin Sharma", pdfFile: "" },
  { title: "The Monk Who Sold His Ferrari", author: "Robin Sharma", price: 210, description: "The Monk Who Sold His Ferrari by Robin Sharma", pdfFile: "" },
  { title: "The Secret", author: "Rhonda Byrne", price: 152, description: "The Secret by Rhonda Byrne", pdfFile: "" },
  { title: "Drive", author: "Daniel H. Pink", price: 317, description: "Drive by Daniel H. Pink", pdfFile: "" },
  { title: "The Richest Man in Babylon", author: "George S. Clason", price: 175, description: "The Richest Man in Babylon by George S. Clason", pdfFile: "" },
  { title: "A Brief History of Time", author: "Stephen Hawking", price: 459, description: "A Brief History of Time by Stephen Hawking", pdfFile: "" },
  { title: "The Alchemist\u2019s Companion", author: "Paulo Coelho", price: 276, description: "The Alchemist\u2019s Companion by Paulo Coelho", pdfFile: "" },
  { title: "Start Now Get Perfect Later", author: "Darius Foroux", price: 183, description: "Start Now Get Perfect Later by Darius Foroux", pdfFile: "" },
  { title: "Atomic Focus", author: "Cal Newport", price: 350, description: "Atomic Focus by Cal Newport", pdfFile: "" },
  { title: "Psychology of Success", author: "Napoleon Hill", price: 158, description: "Psychology of Success by Napoleon Hill", pdfFile: "" },
  { title: "The Obstacle Is the Way", author: "Ryan Holiday", price: 134, description: "The Obstacle Is the Way by Ryan Holiday", pdfFile: "" },
  { title: "The Personal MBA", author: "Josh Kaufman", price: 334, description: "The Personal MBA by Josh Kaufman", pdfFile: "" },
  { title: "Mindset Secrets for Winning", author: "Mark Minervini", price: 240, description: "Mindset Secrets for Winning by Mark Minervini", pdfFile: "" },
  { title: "The 5 AM Club", author: "Robin Sharma", price: 467, description: "The 5 AM Club by Robin Sharma", pdfFile: "" },
  { title: "Life Is What You Make It", author: "Preeti Shenoy", price: 323, description: "Life Is What You Make It by Preeti Shenoy", pdfFile: "" },
  { title: "Rewire Your Brain", author: "John B. Arden", price: 395, description: "Rewire Your Brain by John B. Arden", pdfFile: "" },
  { title: "The Book of Joy", author: "Dalai Lama and Desmond Tutu", price: 197, description: "The Book of Joy by Dalai Lama and Desmond Tutu", pdfFile: "" },
];

function getCategoryForTitle(title, categories) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const normTitle = norm(title);

  for (const [catName, titles] of Object.entries(categoryMap)) {
    for (const t of titles) {
      if (norm(t) === normTitle) {
        const cat = categories.find(c => c.name === catName);
        if (cat) return cat._id;
      }
    }
  }
  // Default to Self Improvement
  const fallback = categories.find(c => c.name === "Self Improvement");
  return fallback ? fallback._id : categories[0]._id;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const categories = await Category.find().lean();
  console.log("Categories:", categories.map(c => c.name).join(", "));

  // 1. Fix typo book
  const typoBook = await Book.findOne({ title: /opstsele/i });
  if (typoBook) {
    typoBook.title = "The Obstacle Is the Way";
    typoBook.pdfUrl = typoBook.pdfUrl; // keep existing
    await typoBook.save();
    console.log("✅ Fixed typo: 'the opstsele is the way' → 'The Obstacle Is the Way'");
  }

  // 2. Fix all existing books' broken categories
  const allBooks = await Book.find();
  const validCatIds = categories.map(c => c._id.toString());
  let fixedCats = 0;
  for (const book of allBooks) {
    const catStr = book.category ? book.category.toString() : "";
    if (!validCatIds.includes(catStr)) {
      book.category = getCategoryForTitle(book.title, categories);
      await book.save();
      fixedCats++;
    }
  }
  console.log(`✅ Fixed ${fixedCats} books with broken categories`);

  // 3. Add missing books
  const existingTitles = (await Book.find({}, "title").lean()).map(b =>
    b.title.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim()
  );

  const pdfBaseUrl = process.env.PDF_BASE_URL || "/pdfs";
  let added = 0;

  for (const mb of missingBooks) {
    const norm = mb.title.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
    if (existingTitles.includes(norm)) {
      console.log(`  ⏭️  Already exists: ${mb.title}`);
      continue;
    }

    const catId = getCategoryForTitle(mb.title, categories);
    await Book.create({
      title: mb.title,
      author: mb.author,
      price: mb.price,
      description: mb.description,
      category: catId,
      pdfUrl: mb.pdfFile ? `${pdfBaseUrl}/${mb.pdfFile}` : `${pdfBaseUrl}/placeholder.pdf`,
      enabled: true,
    });
    added++;
    console.log(`  ✅ Added: ${mb.title}`);
  }
  console.log(`✅ Added ${added} new books`);

  // 4. Apply cover URLs from googleCovers.json
  const coverEntries = Object.values(covers);
  const updatedBooks = await Book.find();
  let coversApplied = 0;

  for (const book of updatedBooks) {
    const normBookTitle = book.title.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
    const match = coverEntries.find(c =>
      c.title.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim() === normBookTitle
    );
    if (match && match.coverUrl) {
      book.coverUrl = match.coverUrl;
      await book.save();
      coversApplied++;
    }
  }
  console.log(`✅ Applied covers to ${coversApplied} books`);

  // Final count
  const total = await Book.countDocuments();
  console.log(`\n📚 Total books in database: ${total}`);

  process.exit(0);
}

main().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
