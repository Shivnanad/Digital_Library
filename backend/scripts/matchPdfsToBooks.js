const fs = require("fs");
const path = require("path");

// Read PDF files from public/pdfs folder
const pdfDir = path.join(__dirname, "../public/pdfs");
const pdfFiles = fs.readdirSync(pdfDir).filter(file => file.endsWith(".pdf"));

// Read googleCovers.json
const coversPath = path.join(__dirname, "../seed/googleCovers.json");
const covers = JSON.parse(fs.readFileSync(coversPath, "utf-8"));

// Get default category ID
const defaultCategoryId = "6961016ccdb40c3ee8471b91"; // Motivation category

// Create books array by matching PDFs with covers
const books = [];
const categories = {
  "Motivation": "6961016ccdb40c3ee8471b91",
  "Fiction": "6961016ccdb40c3ee8471b92",
  "Technology": "6961016ccdb40c3ee8471b93",
  "Business": "6961016ccdb40c3ee8471b94"
};

// Helper function to normalize strings for matching
function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Process each PDF file
pdfFiles.forEach(pdfFile => {
  const pdfName = normalize(pdfFile.replace(".pdf", ""));
  
  // Try to find matching book in covers
  let matchedBook = null;
  for (const [id, bookData] of Object.entries(covers)) {
    const bookTitle = normalize(bookData.title);
    if (bookTitle.includes(pdfName) || pdfName.includes(bookTitle)) {
      matchedBook = bookData;
      break;
    }
  }
  
  if (matchedBook) {
    books.push({
      title: matchedBook.title,
      author: matchedBook.author,
      category: categories.Motivation,
      price: matchedBook.price || 299,
      description: matchedBook.title,
      pdfFile: pdfFile,
      coverUrl: matchedBook.coverUrl
    });
  } else {
    // Create entry for unmatched PDFs
    console.warn(`⚠️  No cover data found for: ${pdfFile}`);
    books.push({
      title: pdfFile.replace(".pdf", "").replace(/_/g, " "),
      author: "Unknown",
      category: defaultCategoryId,
      price: 299,
      description: "Self-help",
      pdfFile: pdfFile
    });
  }
});

// Write updated books.json
const booksPath = path.join(__dirname, "../seed/books.json");
fs.writeFileSync(booksPath, JSON.stringify(books, null, 2));

console.log(`✅ Updated books.json with ${books.length} books`);
console.log(`📁 Total PDFs found: ${pdfFiles.length}`);
console.log(`✔️  Ready to run: node seed/seedBooks.js`);
