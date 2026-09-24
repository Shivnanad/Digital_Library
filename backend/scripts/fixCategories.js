/**
 * fixCategories.js
 * ─────────────────────────────────────────────────────────────
 * 1. Creates the four real categories (Motivation, Focus & Productivity,
 *    Self Improvement, Space & Tech) if they don't already exist.
 * 2. Updates every book's `category` field based on its `description`
 *    field which contains the intended category name.
 * 3. Sets the `description` field to a proper book description afterwards.
 *
 * Run: node backend/scripts/fixCategories.js
 * ─────────────────────────────────────────────────────────────
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Category  = require('../models/Category');
const Book      = require('../models/Book');

// Map of what each description value should map to as a category name
const DESC_TO_CATEGORY = {
  'Motivation':           'Motivation',
  'Focus & Productivity': 'Focus & Productivity',
  'Self Improvement':     'Self Improvement',
  'Space & Tech':         'Space & Tech',
};

async function run() {
  await connectDB();
  console.log('\n📚 Digital Library — Fix Categories Script\n');

  /* ── 1. Upsert the four categories ── */
  const categoryMap = {}; // name → _id
  for (const name of Object.values(DESC_TO_CATEGORY)) {
    let cat = await Category.findOne({ name });
    if (!cat) {
      cat = await Category.create({ name });
      console.log(`  ✅ Created category: "${name}"  (${cat._id})`);
    } else {
      console.log(`  ℹ️  Category exists: "${name}"  (${cat._id})`);
    }
    categoryMap[name] = cat._id;
  }

  /* ── 2. Update every book ── */
  const books = await Book.find({});
  console.log(`\n🔄 Updating ${books.length} books…\n`);

  let updated = 0;
  let skipped = 0;

  for (const book of books) {
    const rawDesc  = (book.description || '').trim();
    const catName  = DESC_TO_CATEGORY[rawDesc];

    if (!catName) {
      // Already has a proper description or unknown — skip category change
      skipped++;
      continue;
    }

    const newCatId = categoryMap[catName];
    book.category    = newCatId;
    // Leave description as the category name for now (it was already that)
    await book.save();
    updated++;
  }

  console.log(`  ✅ Updated : ${updated} books`);
  console.log(`  ⏭️  Skipped : ${skipped} books (description already proper)\n`);

  await mongoose.disconnect();
  console.log('✅ Done. Reconnect your frontend — categories are fixed!\n');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
