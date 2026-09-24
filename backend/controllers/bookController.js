const Book = require("../models/Book");
const Category = require("../models/Category");
const axios = require("axios");

const OLLAMA_URL = process.env.OLLAMA_API_URL || "http://localhost:11434";
const OLLAMA_MODEL = "gemma4:latest";

function parseBooleanField(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return undefined;
}

// ADD A BOOK
const addBook = async (req, res) => {
  try {
    const { title, author, category, price, description, pdfUrl } = req.body;
    const parsedInStock = parseBooleanField(req.body?.inStock);

    // basic validation
    if (!title || !author || !category || !pdfUrl) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    // check category exists
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(404).json({ message: "Category not found" });
    }

    const book = await Book.create({
      title,
      author,
      category,
      price,
      description,
      pdfUrl,
      inStock: parsedInStock === undefined ? true : parsedInStock
    });

    // emit realtime update
    if (req && req.app) {
      const io = req.app.get('io');
      if (io) io.emit('books:changed', { action: 'create', book });
    }

    res.status(201).json(book);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET ALL BOOKS (WITH PAGINATION)
const getAllBooks = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await Book.countDocuments();

    const books = await Book.find()
      .populate("category", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      page,
      limit,
      total,
      books
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET BOOKS BY CATEGORY
const getBooksByCategory = async (req, res) => {
  try {
    const books = await Book.find({ category: req.params.categoryId })
      .populate("category", "name");

    res.json(books);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
/* ═══════════════════════════════════════════════════════════════════
   SMART SEARCH ENGINE
   Features:
     • Intent parsing  ("new releases", "trending", "free books" …)
     • Stop-word stripping  ("books about motivation" → "motivation")
     • Multi-keyword OR search  (every meaningful word searched independently)
     • Fuzzy fallback  (if exact returns 0, try contains-any-word search)
     • Spell-correction hint  (Levenshtein "Did you mean X?")
   ═══════════════════════════════════════════════════════════════════ */

// ── Levenshtein distance ────────────────────────────────────────────
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = [];
  for (let i = 0; i <= m; i++) dp[i] = [i];
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// ── Words to ignore when extracting search keywords ─────────────────
const STOP_WORDS = new Set([
  "book","books","read","reading","about","the","a","an","for","of","by",
  "in","on","at","to","from","and","or","is","are","was","were","be","been",
  "with","some","all","any","this","that","these","those","show","me","give",
  "want","find","search","get","list","top","best","good","great","amazing",
  "i","my","we","our","you","your","can","will","would","should","please"
]);

// ── Intent → DB flag mapping ─────────────────────────────────────────
const INTENT_PATTERNS = [
  { regex: /\bnew\s*release[sd]?\b|\blatest\b|\bjust\s*out\b|\bnewly\b/i,  flag: { newRelease: true } },
  { regex: /\btrend(ing)?\b|\bhot\b|\bbuzz\b/i,                            flag: { trending: true } },
  { regex: /\bfeatured?\b|\bbest\s*seller[s]?\b|\bbest-seller[s]?\b/i,     flag: { featured: true } },
  { regex: /\bfree\b/i,                                                    flag: { price: 0 } },
];

// ── Sort hint from query text ────────────────────────────────────────
function detectSortFromQuery(q) {
  if (/\bcheap(est)?\b|\blow(est)?\s*price\b/i.test(q)) return { price: 1 };
  if (/\bexpensive\b|\bhigh(est)?\s*price\b/i.test(q))  return { price: -1 };
  if (/\brated?\b|\bbest\s*rated?\b/i.test(q))           return { rating: -1 };
  if (/\bpopular\b|\bmost\s*read\b/i.test(q))            return { views: -1 };
  return null;
}

// ── Build "Did you mean?" suggestion ────────────────────────────────
async function buildDidYouMean(queryWords) {
  // Collect vocabulary from existing book titles + authors (limited set)
  const sample = await Book.find({}, { title: 1, author: 1 }).limit(500).lean();
  const vocabSet = new Set();
  sample.forEach(b => {
    (b.title  || "").split(/\s+/).forEach(w => { const c = w.replace(/[^a-z]/gi,"").toLowerCase(); if (c.length > 2) vocabSet.add(c); });
    (b.author || "").split(/\s+/).forEach(w => { const c = w.replace(/[^a-z]/gi,"").toLowerCase(); if (c.length > 2) vocabSet.add(c); });
  });
  const vocab = [...vocabSet];

  let changed = false;
  const corrected = queryWords.map(word => {
    const lw = word.toLowerCase();
    if (vocabSet.has(lw) || lw.length <= 2) return word; // already correct
    // Find closest vocab word within edit-distance 2
    let best = null, bestDist = Infinity;
    for (const v of vocab) {
      if (Math.abs(v.length - lw.length) > 3) continue; // skip obviously wrong
      const d = levenshtein(lw, v);
      if (d < bestDist && d <= 2) { bestDist = d; best = v; }
    }
    if (best && best !== lw) { changed = true; return best; }
    return word;
  });

  return changed ? corrected.join(" ") : null;
}

// SEARCH BOOKS (smart: intent, topic, fuzzy, spell-correction)
const searchBooks = async (req, res) => {
  try {
    const rawQuery = (req.query.q || "").trim();
    const page     = Math.max(1, Number(req.query.page) || 1);
    const limit    = Math.min(50, Number(req.query.limit) || 12);
    const skip     = (page - 1) * limit;
    let   sortParam = req.query.sort || "relevance";
    const categoryFilter = req.query.category || "";
    const minPrice = req.query.minPrice !== undefined && req.query.minPrice !== "" ? Number(req.query.minPrice) : null;
    const maxPrice = req.query.maxPrice !== undefined && req.query.maxPrice !== "" ? Number(req.query.maxPrice) : null;
    const availability = (req.query.availability || "all").toString().trim().toLowerCase();

    if (!rawQuery) return res.status(400).json({ message: "Search query missing" });

    // ── 1. Detect intents (new releases, trending, free …) ──────────
    const extraFlags = {};
    for (const { regex, flag } of INTENT_PATTERNS) {
      if (regex.test(rawQuery)) Object.assign(extraFlags, flag);
    }

    // ── 2. Sort hint from natural language ──────────────────────────
    const nlSort = detectSortFromQuery(rawQuery);

    // ── 3. Extract meaningful keywords (strip stop words) ───────────
    const allWords = rawQuery.split(/\s+/).map(w => w.replace(/[^a-zA-Z0-9]/g, "")).filter(Boolean);
    const keywords = allWords.filter(w => !STOP_WORDS.has(w.toLowerCase()) && w.length > 1);
    const searchWords = keywords.length > 0 ? keywords : allWords.filter(w => w.length > 1);

    // ── 4. Category filter ──────────────────────────────────────────
    let catId = null;
    if (categoryFilter) {
      const catDoc = await Category.findOne({ name: { $regex: categoryFilter, $options: "i" } });
      if (catDoc) catId = catDoc._id;
    }
    // Also detect category from keywords (e.g. "fiction books")
    if (!catId) {
      for (const word of searchWords) {
        const catDoc = await Category.findOne({ name: { $regex: `^${word}$`, $options: "i" } });
        if (catDoc) { catId = catDoc._id; break; }
      }
    }

    // ── 5. Build base filter (price, flags) ─────────────────────────
    const baseFilter = { ...extraFlags };
    if (catId) baseFilter.category = catId;
    if (availability === "out-of-stock") {
      baseFilter.inStock = false;
    } else if (availability === "in-stock") {
      baseFilter.inStock = { $ne: false };
    }
    if (minPrice !== null || maxPrice !== null) {
      baseFilter.price = {};
      if (minPrice !== null) baseFilter.price.$gte = minPrice;
      if (maxPrice !== null) baseFilter.price.$lte = maxPrice;
    }

    // ── 6. Sort option ──────────────────────────────────────────────
    let sortOption = nlSort || { createdAt: -1 };
    switch (sortParam) {
      case "price-asc":  sortOption = { price: 1 };      break;
      case "price-desc": sortOption = { price: -1 };     break;
      case "newest":     sortOption = { createdAt: -1 }; break;
      case "rating":     sortOption = { rating: -1 };    break;
      case "popular":    sortOption = { views: -1 };     break;
    }

    // ── Helper: run search with a given word list ────────────────────
    async function runSearch(words, exact = false) {
      let textCondition;
      if (exact) {
        // phrase match on full raw query
        const r = new RegExp(words.join("\\s+"), "i");
        textCondition = { $or: [{ title: r }, { author: r }, { description: r }] };
      } else {
        // every word must be present somewhere (AND across words, OR across fields)
        const wordConditions = words.map(w => {
          const r = new RegExp(w, "i");
          return { $or: [{ title: r }, { author: r }, { description: r }, { language: r }] };
        });
        textCondition = wordConditions.length === 1 ? wordConditions[0] : { $and: wordConditions };
      }
      const filter = { ...baseFilter, ...textCondition };
      const total  = await Book.countDocuments(filter);
      const books  = total > 0
        ? await Book.find(filter).populate("category", "name").sort(sortOption).skip(skip).limit(limit)
        : [];
      return { total, books };
    }

    // ── 7. Tiered search strategy ────────────────────────────────────
    let result, didYouMean = null, usedQuery = rawQuery;

    // Tier 1: exact phrase match
    result = await runSearch(searchWords.length ? searchWords : allWords, true);

    // Tier 2: all keywords present (AND)
    if (result.total === 0 && searchWords.length > 0) {
      result = await runSearch(searchWords, false);
    }

    // Tier 3: any keyword present (OR) — broadest match
    if (result.total === 0 && searchWords.length > 1) {
      const orConditions = searchWords.map(w => {
        const r = new RegExp(w, "i");
        return { $or: [{ title: r }, { author: r }, { description: r }] };
      });
      const filter = { ...baseFilter, $or: orConditions.flatMap(c => c.$or) };
      const total  = await Book.countDocuments(filter);
      const books  = total > 0
        ? await Book.find(filter).populate("category", "name").sort(sortOption).skip(skip).limit(limit)
        : [];
      result = { total, books };
    }

    // Tier 4: intent-only search (if flags detected and still empty)
    if (result.total === 0 && Object.keys(extraFlags).length > 0) {
      const total = await Book.countDocuments(baseFilter);
      const books = total > 0
        ? await Book.find(baseFilter).populate("category", "name").sort(sortOption).skip(skip).limit(limit)
        : [];
      result = { total, books };
    }

    // Tier 5: spell correction + re-search
    if (result.total === 0) {
      const correction = await buildDidYouMean(searchWords.length ? searchWords : allWords);
      if (correction && correction.toLowerCase() !== rawQuery.toLowerCase()) {
        didYouMean = correction;
        // Try searching with the corrected words
        const corrWords = correction.split(/\s+/);
        const corrResult = await runSearch(corrWords, false);
        if (corrResult.total > 0) {
          result = corrResult;
          usedQuery = correction;
        }
      }
    }

    // Tier 6: AI-powered semantic search (Ollama generates alternative keywords)
    if (result.total === 0) {
      try {
        const allBookSample = await Book.find({}, { title: 1, author: 1 }).limit(200).lean();
        const titleList = allBookSample.map(b => b.title).join(", ");
        const authorList = [...new Set(allBookSample.map(b => b.author))].join(", ");

        const aiPrompt = `The user searched for: "${rawQuery}"
Available book titles: ${titleList.substring(0, 2000)}
Available authors: ${authorList.substring(0, 800)}

Based on the user's search intent, pick the most relevant books from the list above.
Return ONLY a JSON array of the exact book titles that match the intent, nothing else.
If the search is about a topic/genre, pick books that relate to that topic.
If the search is about an author name (even misspelled), pick that author's books.
Return at most 10 titles. Return valid JSON only, like: ["Title1","Title2"]`;

        const aiRes = await axios.post(`${OLLAMA_URL}/v1/chat/completions`, {
          model: OLLAMA_MODEL,
          messages: [{ role: "user", content: aiPrompt }],
          temperature: 0.3,
          max_tokens: 300,
          stream: false
        }, { timeout: 15000 });

        const aiText = (aiRes.data?.choices?.[0]?.message?.content || "").trim();
        // Extract JSON array from AI response
        const jsonMatch = aiText.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
          const aiTitles = JSON.parse(jsonMatch[0]);
          if (Array.isArray(aiTitles) && aiTitles.length > 0) {
            // Search for these exact titles
            const titleRegexes = aiTitles.map(t => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
            const aiFilter = { ...baseFilter, $or: titleRegexes.map(r => ({ title: r })) };
            const aiTotal = await Book.countDocuments(aiFilter);
            const aiBooks = aiTotal > 0
              ? await Book.find(aiFilter).populate("category", "name").sort(sortOption).skip(skip).limit(limit)
              : [];
            if (aiTotal > 0) {
              result = { total: aiTotal, books: aiBooks };
              usedQuery = rawQuery; // keep original, it's AI-interpreted
            }
          }
        }
      } catch (aiErr) {
        // AI search failed — silently continue (non-critical)
        console.warn("AI search fallback failed:", aiErr.message);
      }
    }

    // Tier 7: Partial / substring match as last resort
    if (result.total === 0 && searchWords.length > 0) {
      // Try matching any 3+ char substring from each word
      const partialConditions = searchWords
        .filter(w => w.length >= 3)
        .map(w => {
          // Take first 3 chars as a partial match
          const partial = new RegExp(w.substring(0, Math.min(w.length, 4)), "i");
          return { $or: [{ title: partial }, { author: partial }] };
        });
      if (partialConditions.length > 0) {
        const pFilter = { ...baseFilter, $or: partialConditions.flatMap(c => c.$or) };
        const pTotal = await Book.countDocuments(pFilter);
        const pBooks = pTotal > 0
          ? await Book.find(pFilter).populate("category", "name").sort(sortOption).skip(skip).limit(limit)
          : [];
        result = { total: pTotal, books: pBooks };
      }
    }

    res.json({
      books:          result.books,
      total:          result.total,
      page,
      limit,
      query:          rawQuery,
      usedQuery,                           // actual query used (may differ after correction)
      didYouMean,                          // suggestion shown to user ("Did you mean X?")
      corrected:      usedQuery !== rawQuery, // true if auto-corrected
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET BOOK BY ID
const getBookById = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id).populate("category");

    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    res.json(book);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE A BOOK (admin)
const updateBook = async (req, res) => {
  try {
    const bookId = req.params.id;
    const updates = req.body;
    const parsedInStock = parseBooleanField(req.body?.inStock);

    if (updates.pdfUrl === "") delete updates.pdfUrl;
    if (parsedInStock !== undefined) {
      updates.inStock = parsedInStock;
    }

    const updated = await Book.findByIdAndUpdate(bookId, updates, {
      new: true,
      runValidators: true
    }).populate("category");

    if (!updated) return res.status(404).json({ message: "Book not found" });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE A BOOK (admin)
const deleteBook = async (req, res) => {
  try {
    const bookId = req.params.id;
    const deleted = await Book.findByIdAndDelete(bookId);
    if (!deleted) return res.status(404).json({ message: "Book not found" });
    res.json({ message: "Book deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// TOGGLE ENABLE / DISABLE (admin)
const setBookEnabled = async (req, res) => {
  try {
    const bookId = req.params.id;
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') return res.status(400).json({ message: 'enabled must be boolean' });

    const book = await Book.findByIdAndUpdate(bookId, { enabled }, { new: true }).populate('category');
    if (!book) return res.status(404).json({ message: 'Book not found' });
    res.json(book);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// SET FEATURE FLAGS (trending/featured/newRelease) (admin)
const setBookFlags = async (req, res) => {
  try {
    const bookId = req.params.id;
    const { trending, featured, newRelease } = req.body;
    const updates = {};
    if (typeof trending === 'boolean') updates.trending = trending;
    if (typeof featured === 'boolean') updates.featured = featured;
    if (typeof newRelease === 'boolean') updates.newRelease = newRelease;

    const book = await Book.findByIdAndUpdate(bookId, updates, { new: true }).populate('category');
    if (!book) return res.status(404).json({ message: 'Book not found' });
    res.json(book);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// (original file: no admin-only update/delete helpers here)


module.exports = {
  addBook,
  getAllBooks,
  getBooksByCategory,
  searchBooks,
  getBookById,
  updateBook,
  deleteBook,
  setBookEnabled,
  setBookFlags
};
