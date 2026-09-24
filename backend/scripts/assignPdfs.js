/**
 * assignPdfs.js — Match PDF files to books and update pdfUrl
 * • Only updates books that currently have placeholder.pdf or no PDF
 * • NEVER deletes any PDF file
 * • Removes duplicate PDF files only if two files map to the same book
 *   (keeps the better-named one)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const fs       = require('fs');
const path     = require('path');
const Book     = require('../models/Book');

const PDF_DIR  = path.join(__dirname, '..', 'public', 'pdfs');
const BASE_URL = 'http://localhost:5000/pdfs/';

// ─── Manual mapping: PDF filename → exact book title ───
const PDF_TO_BOOK = {
  // Already-assigned books are skipped automatically (they don't have placeholder.pdf)
  // These are PDFs that exist in the folder but their book still has placeholder.pdf

  'Awaken the Giant Within.pdf':                               'Awaken the Giant Within',
  'The-four-agreements.pdf':                                   'The Four Agreements',
  'Marcus-Aurelius-Meditations.pdf':                           'Meditations',
  'ArtOfWar.pdf':                                              'The Art of War',
  'Power-of-Habit-Chapter-One.pdf':                            'The Power of Habit',
  'Ego_is_the_Enenmyz-lib.org_.pdf':                           'Ego Is the Enemy',
  'Who-Will-Cry-When-You-Die_Robin-Sharma_16.04.2020.pdf':     'Who Will Cry When You Die',
  'The Monk Who Sold His Ferrari .pdf':                        'The Monk Who Sold His Ferrari',
  'The-Richest-Man-in-Babylon.pdf':                            'The Richest Man in Babylon',
  'stephen_hawking_a_brief_history_of_time.pdf':               'A Brief History of Time',
  'the-5-am-club.pdf':                                         'The 5 AM Club',
  'Life is What You Make It PDF.pdf':                          'Life Is What You Make It',
  'RewireYourBrainThinkYourWayToABetterLife2010.pdf':          'Rewire Your Brain',
  'Mindset Secrets for Winning PDF.pdf':                       'Mindset Secrets for Winning',
};

// ─── Duplicate PDFs: keep the one already assigned, skip the duplicate ───
const DUPLICATES = {
  // sapiens_a_brief_histor.pdf is a duplicate of yuval_noah_harari-sapiens_a_brief_histor.pdf
  // Sapiens book already uses yuval... version — we DON'T delete the duplicate, just ignore it
  'sapiens_a_brief_histor.pdf': 'SKIP',
};

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✓ Connected to MongoDB\n');

    // 1. Read all PDF files
    const pdfFiles = fs.readdirSync(PDF_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
    console.log(`Found ${pdfFiles.length} PDF files in ${PDF_DIR}\n`);

    // 2. Get all books
    const books = await Book.find({}).lean();
    console.log(`Found ${books.length} books in database\n`);

    // 3. Find books with placeholder or no PDF
    const needsPdf = books.filter(b =>
      !b.pdfUrl || b.pdfUrl === '' || b.pdfUrl.includes('placeholder.pdf')
    );
    console.log(`Books needing PDF assignment: ${needsPdf.length}`);
    needsPdf.forEach(b => console.log(`  ⚠ ${b.title}`));
    console.log('');

    // 4. Find unassigned PDF files (not used by any book)
    const usedPdfs = new Set(
      books
        .filter(b => b.pdfUrl && !b.pdfUrl.includes('placeholder'))
        .map(b => {
          // Extract filename from URL
          const url = b.pdfUrl;
          return decodeURIComponent(url.split('/pdfs/').pop());
        })
    );

    const unassignedPdfs = pdfFiles.filter(f => !usedPdfs.has(f) && !DUPLICATES[f]);
    console.log(`Unassigned PDF files: ${unassignedPdfs.length}`);
    unassignedPdfs.forEach(f => console.log(`  📄 ${f}`));
    console.log('');

    // 5. Apply manual mapping
    let updated = 0;
    let skipped = 0;

    for (const [pdfFile, bookTitle] of Object.entries(PDF_TO_BOOK)) {
      // Check file exists
      const filePath = path.join(PDF_DIR, pdfFile);
      if (!fs.existsSync(filePath)) {
        console.log(`  ❌ PDF not found: ${pdfFile}`);
        skipped++;
        continue;
      }

      // Find the book
      const book = await Book.findOne({ title: bookTitle });
      if (!book) {
        console.log(`  ❌ Book not found: "${bookTitle}"`);
        skipped++;
        continue;
      }

      // Only update if it has placeholder or no PDF
      if (book.pdfUrl && !book.pdfUrl.includes('placeholder.pdf')) {
        console.log(`  ⏭ Already assigned: "${bookTitle}" → ${book.pdfUrl}`);
        skipped++;
        continue;
      }

      const newUrl = BASE_URL + encodeURIComponent(pdfFile);
      await Book.updateOne({ _id: book._id }, { pdfUrl: newUrl });
      console.log(`  ✅ ${bookTitle} → ${pdfFile}`);
      updated++;
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`✅ Updated: ${updated} books`);
    console.log(`⏭  Skipped: ${skipped}`);

    // 6. Report books still without PDFs
    const stillNeedsPdf = await Book.find({
      $or: [
        { pdfUrl: { $exists: false } },
        { pdfUrl: '' },
        { pdfUrl: /placeholder\.pdf/ }
      ]
    }, 'title pdfUrl').lean();

    if (stillNeedsPdf.length > 0) {
      console.log(`\n⚠ Books still needing PDFs (${stillNeedsPdf.length}):`);
      stillNeedsPdf.forEach(b => console.log(`  • ${b.title}`));
    } else {
      console.log('\n🎉 All books have PDFs assigned!');
    }

    // 7. Report duplicate PDF files (not deleted, just flagged)
    console.log(`\n📋 Duplicate PDFs (not deleted, just noted):`);
    for (const [dup, action] of Object.entries(DUPLICATES)) {
      const exists = fs.existsSync(path.join(PDF_DIR, dup));
      console.log(`  ${exists ? '📄' : '❌'} ${dup} — ${action}`);
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log('Done! No PDFs were deleted.');

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
