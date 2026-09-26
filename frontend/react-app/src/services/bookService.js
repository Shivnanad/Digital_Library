import { API_BASE, BACKEND_URL } from "../config/api.js";
const API_URL = `${API_BASE}/books`;
const BOOKS_CACHE_TTL_MS = 20000;

let booksCache = null;
let booksCacheAt = 0;
let inFlightBooksRequest = null;

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeSearch(value) {
  const normalized = normalizeSearchText(value);
  if (!normalized) return [];
  return normalized.split(" ").filter((w) => w.length > 1);
}

function scoreBookForQuery(book, normalizedQuery, queryTokens) {
  const title = normalizeSearchText(book?.title);
  const author = normalizeSearchText(book?.author);
  const description = normalizeSearchText(book?.description);
  const categoryName = normalizeSearchText(book?.category?.name || book?.category);
  const combined = `${title} ${author} ${description} ${categoryName}`.trim();
  if (!combined) return 0;

  let score = 0;

  if (normalizedQuery) {
    if (title.includes(normalizedQuery)) score += 160;
    if (author.includes(normalizedQuery)) score += 120;
    if (combined.includes(normalizedQuery)) score += 70;
  }

  for (const token of queryTokens) {
    if (title === token) score += 80;
    if (author === token) score += 70;
    if (title.includes(token)) score += 32;
    if (author.includes(token)) score += 24;
    if (categoryName.includes(token)) score += 20;
    if (description.includes(token)) score += 10;

    // Prefix matches help with incomplete typing (e.g. "atom" -> "atomic")
    if (title.split(" ").some((w) => w.startsWith(token))) score += 8;
    if (author.split(" ").some((w) => w.startsWith(token))) score += 6;
  }

  return score;
}

async function fallbackSearchBooks({ query, limit = 8, page = 1, category = "", minPrice, maxPrice, availability = "all" } = {}) {
  const normalizedQuery = normalizeSearchText(query);
  const queryTokens = tokenizeSearch(query);
  if (!normalizedQuery && queryTokens.length === 0) {
    return { books: [], total: 0, page, limit };
  }

  const allBooksData = await fetchBooks();
  const allBooks = Array.isArray(allBooksData?.books) ? allBooksData.books : [];

  const normalizedCategory = normalizeSearchText(category);
  const normalizedAvailability = String(availability || "all").trim().toLowerCase();
  const min = minPrice !== undefined && minPrice !== "" ? Number(minPrice) : null;
  const max = maxPrice !== undefined && maxPrice !== "" ? Number(maxPrice) : null;

  const scored = allBooks
    .map((book) => {
      if (normalizedCategory) {
        const bCategory = normalizeSearchText(book?.category?.name || book?.category);
        if (!bCategory.includes(normalizedCategory)) return null;
      }

      const price = Number(book?.price || 0);
      if (min !== null && !Number.isNaN(min) && price < min) return null;
      if (max !== null && !Number.isNaN(max) && price > max) return null;

      const isOutOfStock = book?.inStock === false;
      if (normalizedAvailability === "in-stock" && isOutOfStock) return null;
      if (normalizedAvailability === "out-of-stock" && !isOutOfStock) return null;

      const score = scoreBookForQuery(book, normalizedQuery, queryTokens);
      if (score <= 0) return null;
      return { book, score };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aViews = Number(a.book?.views || 0);
      const bViews = Number(b.book?.views || 0);
      return bViews - aViews;
    });

  const total = scored.length;
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Number(limit) || 8);
  const start = (safePage - 1) * safeLimit;
  const books = scored.slice(start, start + safeLimit).map((x) => normalizeBook(x.book));

  return { books, total, page: safePage, limit: safeLimit };
}

function normalizeBook(book) {
  if (!book || typeof book !== 'object') return book;
  
  // Get coverUrl from API response, or use fallback
  const coverFallbackJpg = book._id ? `/covers/${book._id}.jpg` : null;
  let coverUrl = book.coverUrl || book.cover || book.image || book.coverPath || coverFallbackJpg || "/placeholder-book.png";
  
  // Prepend backend URL for local cover paths (uploaded via admin panel)
  if (coverUrl && coverUrl.startsWith("/covers/")) {
    coverUrl = `${BACKEND_URL}${coverUrl}`;
  }
  
  // Return book with coverUrl explicitly set
  return { 
    ...book, 
    coverUrl,  // Ensure coverUrl is always present
    cover: coverUrl  // Keep for backward compatibility
  };
}

export async function fetchBooks({ force = false } = {}) {
  try {
    const now = Date.now();
    if (!force && booksCache && now - booksCacheAt < BOOKS_CACHE_TTL_MS) {
      return booksCache;
    }

    if (!force && inFlightBooksRequest) {
      return inFlightBooksRequest;
    }

    inFlightBooksRequest = (async () => {
    // Request books with reasonable limit for frontend cache
    const url = `${API_URL}?page=1&limit=500`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const data = await res.json();
    let normalized = { books: [] };
    
    // Return consistent format - always { books: [...] }
    if (Array.isArray(data)) {
      normalized = { books: data.map(normalizeBook) };
      booksCache = normalized;
      booksCacheAt = Date.now();
      return normalized;
    }

    if (data && typeof data === 'object') {
      // If response has books array, return it
      if (Array.isArray(data.books)) {
        normalized = { books: data.books.map(normalizeBook) };
        booksCache = normalized;
        booksCacheAt = Date.now();
        return normalized;
      }
      // If response is a single book object, normalize and return
      if (data._id) {
        normalized = normalizeBook(data);
        booksCache = normalized;
        booksCacheAt = Date.now();
        return normalized;
      }
      // If response is already structured but not an array, return as-is
      normalized = data;
      booksCache = normalized;
      booksCacheAt = Date.now();
      return normalized;
    }

    // Fallback
    normalized = { books: [] };
    booksCache = normalized;
    booksCacheAt = Date.now();
    return normalized;
    })();

    const result = await inFlightBooksRequest;
    return result;
  } catch (error) {
    console.error("fetchBooks error:", error);
    throw error;
  } finally {
    inFlightBooksRequest = null;
  }
}

export async function fetchBookById(id) {
  try {
    if (!id) {
      throw new Error("Book ID is required");
    }
    
    const url = `${API_URL}/${id}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const data = await res.json();
    console.log("Book data:", data);
    return normalizeBook(data);
  } catch (error) {
    console.error("fetchBookById error:", error);
    throw error;
  }
}

export async function searchBooks(query, limit = 8) {
  try {
    if (!query || !query.trim()) return [];
    const url = `${API_URL}/search?q=${encodeURIComponent(query)}&limit=${limit}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' }, signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    const backendBooks = Array.isArray(data)
      ? data.map(normalizeBook).slice(0, limit)
      : (data && Array.isArray(data.books) ? data.books.map(normalizeBook).slice(0, limit) : []);

    if (backendBooks.length > 0) return backendBooks;

    const fallback = await fallbackSearchBooks({ query, limit, page: 1 });
    return fallback.books;
  } catch (err) {
    console.error('searchBooks error:', err);
    try {
      const fallback = await fallbackSearchBooks({ query, limit, page: 1 });
      return fallback.books;
    } catch {
      return [];
    }
  }
}

// Full search with filters, sorting and pagination (for SearchResults page)
export async function searchBooksWithFilters({ query, page = 1, limit = 12, sort = "relevance", category = "", minPrice, maxPrice, availability = "all" } = {}) {
  try {
    if (!query || !query.trim()) return { books: [], total: 0, page: 1, limit };
    const params = new URLSearchParams();
    params.set("q", query.trim());
    params.set("page", page);
    params.set("limit", limit);
    params.set("sort", sort);
    if (category) params.set("category", category);
    if (minPrice !== undefined && minPrice !== "") params.set("minPrice", minPrice);
    if (maxPrice !== undefined && maxPrice !== "") params.set("maxPrice", maxPrice);
    if (availability && availability !== "all") params.set("availability", availability);
    const url = `${API_URL}/search?${params.toString()}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, { method: "GET", headers: { "Content-Type": "application/json" }, signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    const backendPayload = {
      books:      (data.books || []).map(normalizeBook),
      total:      data.total || 0,
      page:       data.page || page,
      limit:      data.limit || limit,
      query:      data.query || query.trim(),
      usedQuery:  data.usedQuery || data.query || query.trim(),
      didYouMean: data.didYouMean || null,   // spell-correction suggestion
      corrected:  data.corrected || false,    // true if backend auto-corrected
    };

    if (backendPayload.total > 0) return backendPayload;

    const fallback = await fallbackSearchBooks({
      query,
      page,
      limit,
      category,
      minPrice,
      maxPrice,
      availability,
    });

    return {
      books: fallback.books,
      total: fallback.total,
      page: fallback.page,
      limit: fallback.limit,
      query: query.trim(),
      usedQuery: query.trim(),
      didYouMean: null,
      corrected: false,
    };
  } catch (err) {
    console.error("searchBooksWithFilters error:", err);
    try {
      const fallback = await fallbackSearchBooks({
        query,
        page,
        limit,
        category,
        minPrice,
        maxPrice,
        availability,
      });

      return {
        books: fallback.books,
        total: fallback.total,
        page: fallback.page,
        limit: fallback.limit,
        query: query?.trim() || "",
        usedQuery: query?.trim() || "",
        didYouMean: null,
        corrected: false,
      };
    } catch {
      return { books: [], total: 0, page: 1, limit, didYouMean: null, corrected: false };
    }
  }
}

