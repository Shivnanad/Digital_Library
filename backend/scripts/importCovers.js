const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Book = require('../models/Book');

// Configure your MongoDB connection string in .env or set MONGO_URI env var
const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/digital-library';
const COVERS_DIR = path.join(__dirname, '..', 'public', 'covers');

async function run() {
  if (!fs.existsSync(COVERS_DIR)) {
    console.error('Covers directory not found:', COVERS_DIR);
    process.exit(1);
  }

  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  const files = fs.readdirSync(COVERS_DIR).filter(f => !f.startsWith('.'));
  console.log('Found files:', files.length);

  for (const file of files) {
    const name = path.parse(file).name; // filename without ext
    const url = `/covers/${file}`; // store relative to server root

    try {
      // Try matching by ObjectId filename
      if (/^[0-9a-fA-F]{24}$/.test(name)) {
        const updated = await Book.findByIdAndUpdate(name, { coverUrl: url }, { new: true }).exec();
        if (updated) {
          console.log(`Updated book ${name} -> ${url}`);
          continue;
        }
      }

// Fallback: try matching by slugified title or exact title
// Normalize to a simple slug: lower-case, spaces and non-word removed
const slug = name.replace(/[-_]+/g, ' ').replace(/[^A-Za-z0-9 ]/g, '').trim();
      let book = await Book.findOne({ title: new RegExp(`^${slug}$`, 'i') }).exec();
      if (!book) {
        // also try matching by title containing the filename words (loose match)
        const parts = slug.split(' ').filter(Boolean);
        if (parts.length) {
          const re = parts.map(p => `(?=.*${p})`).join('');
          book = await Book.findOne({ title: { $regex: new RegExp(`${re}`, 'i') } }).exec();
        }
      }

      if (book) {
        book.coverUrl = url;
        await book.save();
        console.log(`Matched by title: ${book._id} <- ${file}`);
        continue;
      }

      console.warn('No book match for file:', file);
    } catch (err) {
      console.error('Error processing', file, err.message);
    }
  }

  await mongoose.disconnect();
  console.log('Done');
}

run().catch(err => { console.error(err); process.exit(1); });
