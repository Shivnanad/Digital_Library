const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const Book = require('../models/Book');

// Load backend/.env even if script is run from workspace root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function run() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI not set in environment.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const title = 'Stillness Is the Key';
  const coverPath = '/covers/stillness.jpg';

  try {
    const res = await Book.updateOne({ title }, { $set: { coverUrl: coverPath, cover: coverPath } });
    console.log(`Updated ${res.matchedCount} document(s), modified ${res.modifiedCount}`);
  } catch (err) {
    console.error('Update failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected');
    process.exit(0);
  }
}

run();
