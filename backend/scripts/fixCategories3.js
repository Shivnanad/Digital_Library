require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Category = require('../models/Category');
const Book = require('../models/Book');
const booksJson = require('../seed/books.json');

// Proper categories from books.json descriptions
const KEEP_CATEGORIES = ['Motivation', 'Focus & Productivity', 'Self Improvement', 'Space & Tech'];

// Irrelevant ones to remove (added by mistake)
const REMOVE_CATEGORIES = [
  'Biography', 'Fiction', 'Non-Fiction', 'History', 'Science',
  'Philosophy', 'Business & Finance', 'Psychology', 'Mystery & Thriller',
  'Romance', 'Fantasy', 'Health & Wellness', 'Politics', 'Technology', 'Self-Help'
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB\n');

  // 1. Remove irrelevant categories
  for (const name of REMOVE_CATEGORIES) {
    const cat = await Category.findOne({ name });
    if (cat) {
      // Move any books in this category to Motivation as fallback
      const motiv = await Category.findOne({ name: 'Motivation' });
      if (motiv) {
        const moved = await Book.updateMany({ category: cat._id }, { $set: { category: motiv._id } });
        if (moved.modifiedCount) console.log(`  Moved ${moved.modifiedCount} books from "${name}" → Motivation`);
      }
      await Category.findByIdAndDelete(cat._id);
      console.log(`  ✗ Removed: ${name}`);
    }
  }

  // 2. Ensure proper categories exist
  const catMap = {};
  for (const name of KEEP_CATEGORIES) {
    let cat = await Category.findOne({ name });
    if (!cat) { cat = await Category.create({ name }); console.log(`  + Created: ${name}`); }
    else console.log(`  ✓ Exists:  ${name}`);
    catMap[name] = cat._id;
  }

  console.log('\nReassigning books by description field...');

  // 3. Reassign every book based on its description in books.json
  let updated = 0, skipped = 0;
  for (const entry of booksJson) {
    const descCat = entry.description; // e.g. "Motivation"
    const targetCatId = catMap[descCat];
    if (!targetCatId) { skipped++; continue; }

    const book = await Book.findOne({ title: { $regex: entry.title.replace(/[^a-zA-Z0-9 ]/g, '').trim(), $options: 'i' } });
    if (!book) { skipped++; continue; }

    book.category = targetCatId;
    await book.save();
    updated++;
  }

  console.log(`  Reassigned: ${updated} books`);
  if (skipped) console.log(`  Skipped:    ${skipped} (title not matched or unknown category)`);

  // 4. Final state
  console.log('\nFinal categories in DB:');
  const all = await Category.find().sort('name');
  for (const c of all) {
    const count = await Book.countDocuments({ category: c._id });
    console.log(`  • ${c.name.padEnd(25)} (${count} books)`);
  }

  await mongoose.disconnect();
  console.log('\nDone!');
}

run().catch(err => { console.error(err); process.exit(1); });
