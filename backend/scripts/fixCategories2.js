require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Category = require('../models/Category');
const Book = require('../models/Book');

const NEW_CATEGORIES = [
  'Self-Help',
  'Fiction',
  'Non-Fiction',
  'Biography',
  'History',
  'Science',
  'Philosophy',
  'Business & Finance',
  'Psychology',
  'Mystery & Thriller',
  'Romance',
  'Fantasy',
  'Technology',
  'Health & Wellness',
  'Politics',
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Find "Computer Science" category
  const cs = await Category.findOne({ name: /computer science/i });

  let fallbackCat = null;

  if (cs) {
    console.log(`Found "Computer Science" (${cs._id})`);

    // Pick a fallback to reassign CS books to — use "Technology" or create it
    let techCat = await Category.findOne({ name: /technology/i });
    if (!techCat) {
      techCat = await Category.create({ name: 'Technology' });
      console.log('Created "Technology" category');
    }
    fallbackCat = techCat;

    // Reassign all books under Computer Science → Technology
    const updated = await Book.updateMany({ category: cs._id }, { $set: { category: techCat._id } });
    console.log(`Reassigned ${updated.modifiedCount} books from Computer Science → Technology`);

    await Category.findByIdAndDelete(cs._id);
    console.log('Deleted "Computer Science" category');
  } else {
    console.log('No "Computer Science" category found');
  }

  // Add all new categories (skip if already exists)
  for (const name of NEW_CATEGORIES) {
    const exists = await Category.findOne({ name });
    if (!exists) {
      await Category.create({ name });
      console.log(`  + Added: ${name}`);
    } else {
      console.log(`  ~ Already exists: ${name}`);
    }
  }

  const all = await Category.find().sort('name');
  console.log('\nAll categories now in DB:');
  all.forEach(c => console.log(`  • ${c.name}`));

  await mongoose.disconnect();
  console.log('\nDone!');
}

run().catch(err => { console.error(err); process.exit(1); });
