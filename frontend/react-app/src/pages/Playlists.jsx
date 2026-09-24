import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getPlaylists,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  addBookToPlaylist,
  removeBookFromPlaylist,
} from "../services/playlistService";
import { fetchBooks } from "../services/bookService";
import "../styles/playlists.css";

/* ─── helpers ─── */
const PALETTE = [
  "#8b5cf6","#f59e0b","#ec4899","#06b6d4","#10b981","#f97316","#3b82f6","#ef4444",
];

const Icon = ({ d, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  plus:    "M12 5v14M5 12h14",
  edit:    "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  trash:   "M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6",
  search:  "M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z",
  library: "M2 6h4v14H2zM10 3h4v17h-4zM18 8h4v12h-4z",
  close:   "M18 6L6 18M6 6l12 12",
  back:    "M19 12H5M12 5l-7 7 7 7",
  check:   "M20 6L9 17l-5-5",
  book:    "M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 014 17V4h16v13M4 19.5V21",
  empty:   "M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z",
  chevron: "M6 9l6 6 6-6",
  upload:  "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12",
};

/* ─── localStorage cover-image helpers ─── */
const LS_KEY = "readify_playlist_covers";
const getStoredCovers   = ()            => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; } };
const saveStoredCover   = (id, dataURL) => { const m = getStoredCovers(); m[id] = dataURL; localStorage.setItem(LS_KEY, JSON.stringify(m)); };
const removeStoredCover = (id)          => { const m = getStoredCovers(); delete m[id]; localStorage.setItem(LS_KEY, JSON.stringify(m)); };

/* ═══════════════════════════════════════════════════════════ */
export default function Playlists() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [playlists, setPlaylists]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");

  /* modal state */
  const [modal, setModal]           = useState(null); // null | "create" | "edit" | "delete" | "view"
  const [activePlaylist, setActive] = useState(null);

  /* form fields */
  const [formName, setFormName]     = useState("");
  const [formDesc, setFormDesc]     = useState("");
  const [formColor, setFormColor]   = useState(PALETTE[0]);
  const [formErr, setFormErr]       = useState("");
  const [saving, setSaving]         = useState(false);

  /* book browser inside view-modal */
  const [allBooks, setAllBooks]         = useState([]);
  const [booksLoading, setBooksLoading] = useState(false);
  const [searchQ, setSearchQ]           = useState("");
  const [openCats, setOpenCats]         = useState({});
  const searchTimer                     = useRef(null);

  /* cover images (localStorage) */
  const [coverImages, setCoverImages]         = useState(() => getStoredCovers());
  const [formImagePreview, setFormImagePreview] = useState(null); // base64 dataURL | null
  const imgInputRef                           = useRef(null);

  /* ─── load playlists ─── */
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPlaylists();
      setPlaylists(data.playlists || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    load();
  }, [user, navigate, load]);

  /* derive filtered/grouped books for the browser */
  const filteredBooks = searchQ.trim()
    ? allBooks.filter(b =>
        b.title?.toLowerCase().includes(searchQ.toLowerCase()) ||
        b.author?.toLowerCase().includes(searchQ.toLowerCase())
      )
    : allBooks;

  const grouped = filteredBooks.reduce((acc, book) => {
    const cat = (typeof book.category === "object" && book.category?.name)
      ? book.category.name
      : (typeof book.category === "string" ? book.category : "Uncategorized");
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(book);
    return acc;
  }, {});

  /* ─── open modal helpers ─── */
  const openCreate = () => {
    setFormName(""); setFormDesc(""); setFormColor(PALETTE[0]); setFormErr("");
    setFormImagePreview(null);
    setModal("create");
  };

  const openEdit = (pl) => {
    setActive(pl);
    setFormName(pl.name); setFormDesc(pl.description || ""); setFormColor(pl.coverColor || PALETTE[0]);
    setFormErr("");
    setFormImagePreview(coverImages[pl._id] || null);
    setModal("edit");
  };

  const openView = async (pl) => {
    setActive(pl); setSearchQ(""); setOpenCats({});
    setModal("view");
    if (allBooks.length === 0) {
      setBooksLoading(true);
      try {
        const data = await fetchBooks();
        setAllBooks(data.books || []);
      } catch {}
      finally { setBooksLoading(false); }
    }
  };

  const openDelete = (pl) => { setActive(pl); setModal("delete"); };

  const closeModal = () => { setModal(null); setActive(null); setFormErr(""); };

  /* ─── CRUD actions ─── */
  const handleCreate = async () => {
    if (!formName.trim()) { setFormErr("Please enter a playlist name."); return; }
    setSaving(true);
    try {
      const data = await createPlaylist(formName, formDesc, formColor);
      if (formImagePreview) {
        saveStoredCover(data.playlist._id, formImagePreview);
        setCoverImages(getStoredCovers());
      }
      setPlaylists(prev => [data.playlist, ...prev]);
      closeModal();
    } catch (e) { setFormErr(e.message); }
    finally { setSaving(false); }
  };

  const handleUpdate = async () => {
    if (!formName.trim()) { setFormErr("Playlist name cannot be empty."); return; }
    setSaving(true);
    try {
      const data = await updatePlaylist(activePlaylist._id, { name: formName, description: formDesc, coverColor: formColor });
      if (formImagePreview) {
        saveStoredCover(data.playlist._id, formImagePreview);
      } else {
        removeStoredCover(data.playlist._id);
      }
      setCoverImages(getStoredCovers());
      setPlaylists(prev => prev.map(p => p._id === data.playlist._id ? data.playlist : p));
      closeModal();
    } catch (e) { setFormErr(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await deletePlaylist(activePlaylist._id);
      removeStoredCover(activePlaylist._id);
      setCoverImages(getStoredCovers());
      setPlaylists(prev => prev.filter(p => p._id !== activePlaylist._id));
      closeModal();
    } catch (e) { setFormErr(e.message); }
    finally { setSaving(false); }
  };

  const handleAddBook = async (book) => {
    if (!activePlaylist) return;
    try {
      const data = await addBookToPlaylist(activePlaylist._id, book._id);
      const updated = data.playlist;
      setPlaylists(prev => prev.map(p => p._id === updated._id ? updated : p));
      setActive(updated);
    } catch (e) {
      alert(e.message);
    }
  };

  const handleRemoveBook = async (bookId) => {
    if (!activePlaylist) return;
    try {
      const data = await removeBookFromPlaylist(activePlaylist._id, bookId);
      const updated = data.playlist;
      setPlaylists(prev => prev.map(p => p._id === updated._id ? updated : p));
      setActive(updated);
    } catch (e) {
      alert(e.message);
    }
  };

  /* ─── playlist image helpers ─── */
  const pickImage = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = e => setFormImagePreview(e.target.result);
    reader.readAsDataURL(file);
  };
  const clearImage = () => { setFormImagePreview(null); if (imgInputRef.current) imgInputRef.current.value = ""; };

  /* ─── book cover helper ─── */
  const bookCover = (book) => {
    if (book.coverUrl && !book.coverUrl.startsWith("/placeholder")) return book.coverUrl.startsWith("http") ? book.coverUrl : `http://localhost:5000${book.coverUrl}`;
    if (book._id) return `http://localhost:5000/covers/${book._id}.jpg`;
    return null;
  };

  /* ─── form modal (create / edit) ─── */
  const renderFormModal = (mode) => (
    <div className="pl-overlay" onClick={closeModal}>
      <div className="pl-modal pl-modal--form" onClick={e => e.stopPropagation()}>
        <div className="pl-modal-header">
          <h2>{mode === "create" ? "Create Playlist" : "Edit Playlist"}</h2>
          <button className="pl-icon-btn" onClick={closeModal}><Icon d={ICONS.close} /></button>
        </div>

        <div className="pl-modal-body">
          <label className="pl-label">
            Playlist Name *
            <input
              className="pl-input"
              placeholder="e.g. Summer Reads"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              maxLength={60}
              autoFocus
            />
          </label>

          <label className="pl-label">
            Description <span className="pl-opt">(optional)</span>
            <textarea
              className="pl-input pl-textarea"
              placeholder="What is this playlist about?"
              value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              maxLength={200}
              rows={3}
            />
          </label>

          <div className="pl-label">
            Cover Image <span className="pl-opt">(optional)</span>
            {formImagePreview ? (
              <div className="pl-img-preview-wrap">
                <img className="pl-img-preview" src={formImagePreview} alt="Cover preview" />
                <button className="pl-img-remove-btn" onClick={clearImage} title="Remove image">
                  <Icon d={ICONS.close} size={14} />
                </button>
              </div>
            ) : (
              <div
                className="pl-img-drop"
                onClick={() => imgInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("drag-over"); }}
                onDragLeave={e => e.currentTarget.classList.remove("drag-over")}
                onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove("drag-over"); pickImage(e.dataTransfer.files[0]); }}
              >
                <Icon d={ICONS.upload} size={24} />
                <span className="pl-img-drop-hint">Click or drag an image here</span>
              </div>
            )}
            <input
              ref={imgInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={e => pickImage(e.target.files[0])}
            />
          </div>

          <div className="pl-label">
            Cover Colour
            <div className="pl-palette">
              {PALETTE.map(c => (
                <button
                  key={c}
                  className={`pl-swatch${formColor === c ? " active" : ""}`}
                  style={{ background: c }}
                  onClick={() => setFormColor(c)}
                  aria-label={c}
                >
                  {formColor === c && <Icon d={ICONS.check} size={14} />}
                </button>
              ))}
            </div>
          </div>

          {/* preview */}
          <div className="pl-card-preview" style={{ "--pl-color": formColor }}>
            {formImagePreview
              ? <img className="pl-card-preview-img" src={formImagePreview} alt="Preview" />
              : <div className="pl-card-preview-icon"><Icon d={ICONS.library} size={28} /></div>
            }
            <div className="pl-card-preview-name">{formName || "Playlist Name"}</div>
            <div className="pl-card-preview-count">0 books</div>
          </div>

          {formErr && <div className="pl-form-err">{formErr}</div>}
        </div>

        <div className="pl-modal-footer">
          <button className="pl-btn-ghost" onClick={closeModal} disabled={saving}>Cancel</button>
          <button
            className="pl-btn-primary"
            onClick={mode === "create" ? handleCreate : handleUpdate}
            disabled={saving}
          >
            {saving ? "Saving…" : mode === "create" ? "Create Playlist" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );

  /* ─── delete modal ─── */
  const renderDeleteModal = () => (
    <div className="pl-overlay" onClick={closeModal}>
      <div className="pl-modal pl-modal--confirm" onClick={e => e.stopPropagation()}>
        <div className="pl-modal-header">
          <h2>Delete Playlist?</h2>
          <button className="pl-icon-btn" onClick={closeModal}><Icon d={ICONS.close} /></button>
        </div>
        <div className="pl-modal-body">
          <p>Are you sure you want to delete <strong>"{activePlaylist?.name}"</strong>? This action cannot be undone.</p>
          {formErr && <div className="pl-form-err">{formErr}</div>}
        </div>
        <div className="pl-modal-footer">
          <button className="pl-btn-ghost" onClick={closeModal} disabled={saving}>Cancel</button>
          <button className="pl-btn-danger" onClick={handleDelete} disabled={saving}>
            {saving ? "Deleting…" : "Delete Playlist"}
          </button>
        </div>
      </div>
    </div>
  );

  /* ─── view playlist modal ─── */
  const renderViewModal = () => {
    const pl = activePlaylist;
    if (!pl) return null;
    const alreadyIds = new Set((pl.books || []).map(b => b._id || b));
    return (
      <div className="pl-overlay" onClick={closeModal}>
        <div className="pl-modal pl-modal--view" onClick={e => e.stopPropagation()}>
          {/* header */}
          <div className="pl-view-header" style={{ "--pl-color": pl.coverColor || PALETTE[0] }}>
            <div className="pl-view-icon">
              {coverImages[pl._id]
                ? <img className="pl-view-cover-img" src={coverImages[pl._id]} alt={pl.name} />
                : <Icon d={ICONS.library} size={32} />
              }
            </div>
            <div className="pl-view-meta">
              <h2>{pl.name}</h2>
              {pl.description && <p>{pl.description}</p>}
              <span className="pl-view-count">{pl.books?.length || 0} books</span>
            </div>
            <div className="pl-view-actions">
              <button className="pl-icon-btn" title="Edit" onClick={() => { closeModal(); setTimeout(() => openEdit(pl), 50); }}>
                <Icon d={ICONS.edit} size={18} />
              </button>
              <button className="pl-icon-btn pl-icon-btn--danger" title="Delete" onClick={() => { closeModal(); setTimeout(() => openDelete(pl), 50); }}>
                <Icon d={ICONS.trash} size={18} />
              </button>
              <button className="pl-icon-btn" onClick={closeModal}><Icon d={ICONS.close} size={18} /></button>
            </div>
          </div>

          <div className="pl-view-body">
            {/* ── Add Books Browser ── */}
            <div className="pl-browser">
              <div className="pl-browser-title">Add Books</div>

              {/* search filter */}
              <div className="pl-search-box">
                <Icon d={ICONS.search} size={18} />
                <input
                  className="pl-search-input"
                  placeholder="Filter by title or author…"
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                />
                {searchQ && (
                  <button className="pl-icon-btn pl-clear-btn" onClick={() => setSearchQ("")}>
                    <Icon d={ICONS.close} size={14} />
                  </button>
                )}
              </div>

              {/* category groups */}
              <div className="pl-cat-list">
                {booksLoading && <div className="pl-search-loading">Loading books…</div>}
                {!booksLoading && Object.keys(grouped).length === 0 && (
                  <div className="pl-search-loading">No books found.</div>
                )}
                {!booksLoading && Object.entries(grouped).map(([cat, books]) => {
                  const isOpen = openCats[cat] !== false; // default open
                  return (
                    <div key={cat} className="pl-cat-group">
                      <button
                        className="pl-cat-header"
                        onClick={() => setOpenCats(p => ({ ...p, [cat]: !isOpen }))}
                      >
                        <span className="pl-cat-name">{cat}</span>
                        <span className="pl-cat-badge">{books.length}</span>
                        <span className={`pl-cat-chevron${isOpen ? " open" : ""}`}>
                          <Icon d={ICONS.chevron} size={15} />
                        </span>
                      </button>

                      {isOpen && (
                        <div className="pl-cat-books">
                          {books.map(book => {
                            const added = alreadyIds.has(book._id);
                            return (
                              <div key={book._id} className={`pl-search-item${added ? " added" : ""}`}>
                                <div className="pl-search-cover">
                                  {bookCover(book)
                                    ? <img src={bookCover(book)} alt={book.title} onError={e => { e.target.style.display = "none"; }} />
                                    : <div className="pl-cover-fallback"><Icon d={ICONS.book} size={20} /></div>
                                  }
                                </div>
                                <div className="pl-search-info">
                                  <div className="pl-search-title">{book.title}</div>
                                  <div className="pl-search-author">{book.author}</div>
                                </div>
                                <button
                                  className={`pl-add-book-btn${added ? " added" : ""}`}
                                  onClick={() => !added && handleAddBook(book)}
                                  disabled={added}
                                >
                                  {added ? <Icon d={ICONS.check} size={16} /> : <Icon d={ICONS.plus} size={16} />}
                                  {added ? "In list" : "Add"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* books list */}
            <div className="pl-books-list">
              <div className="pl-books-list-label">Books in this list ({pl.books?.length || 0})</div>
              {(!pl.books || pl.books.length === 0) ? (
                <div className="pl-empty-books">
                  <Icon d={ICONS.empty} size={42} />
                  <p>No books yet. Browse above to add some!</p>
                </div>
              ) : (
                pl.books.map((book, i) => (
                  <div key={book._id || i} className="pl-book-row">
                    <span className="pl-book-num">{i + 1}</span>
                    <div className="pl-book-cover">
                      {bookCover(book)
                        ? <img src={bookCover(book)} alt={book.title} onError={e => { e.target.style.display = "none"; }} />
                        : <div className="pl-cover-fallback small"><Icon d={ICONS.book} size={16} /></div>
                      }
                    </div>
                    <div className="pl-book-info">
                      <div className="pl-book-title"
                        onClick={() => navigate(`/book/${book._id}`)}
                        style={{ cursor: "pointer" }}
                      >{book.title}</div>
                      <div className="pl-book-author">{book.author}</div>
                    </div>
                    {book.price != null && (
                      <div className="pl-book-price">${typeof book.price === "number" ? book.price.toFixed(2) : book.price}</div>
                    )}
                    <button
                      className="pl-remove-btn"
                      title="Remove from playlist"
                      onClick={() => handleRemoveBook(book._id)}
                    >
                      <Icon d={ICONS.close} size={15} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ─── main render ─── */
  return (
    <div className="pl-page">
      {/* top bar */}
      <div className="pl-topbar">
        <button className="pl-back-btn" onClick={() => navigate("/account")}>
          <Icon d={ICONS.back} size={18} /> Back to Account
        </button>
        <div className="pl-topbar-title">
          <Icon d={ICONS.library} size={22} />
          <h1>My Reading Lists</h1>
        </div>
        <button className="pl-create-btn" onClick={openCreate}>
          <Icon d={ICONS.plus} size={18} /> New Playlist
        </button>
      </div>

      {/* content */}
      <div className="pl-content">
        {loading ? (
          <div className="pl-spinner-wrap">
            <div className="pl-spinner" />
            <p>Loading playlists…</p>
          </div>
        ) : error ? (
          <div className="pl-error-wrap">
            <p>⚠️ {error}</p>
            <button className="pl-btn-primary" onClick={load}>Retry</button>
          </div>
        ) : playlists.length === 0 ? (
          <div className="pl-empty-state">
            <div className="pl-empty-icon"><Icon d={ICONS.library} size={56} /></div>
            <h2>No reading lists yet</h2>
            <p>Create your first playlist and start curating your reading collections.</p>
            <button className="pl-btn-primary pl-btn-lg" onClick={openCreate}>
              <Icon d={ICONS.plus} size={18} /> Create First Playlist
            </button>
          </div>
        ) : (
          <div className="pl-grid">
            {/* create card */}
            <button className="pl-card pl-card--new" onClick={openCreate}>
              <div className="pl-card-new-icon"><Icon d={ICONS.plus} size={30} /></div>
              <span>New Playlist</span>
            </button>

            {playlists.map(pl => (
              <div
                key={pl._id}
                className="pl-card"
                style={{ "--pl-color": pl.coverColor || "#8b5cf6" }}
                onClick={() => openView(pl)}
              >
                {/* custom cover image or book mini covers */}
                {coverImages[pl._id] ? (
                  <div className="pl-card-covers pl-card-covers--img">
                    <img className="pl-card-custom-img" src={coverImages[pl._id]} alt={pl.name} />
                  </div>
                ) : (
                <div className="pl-card-covers">
                  {(pl.books || []).slice(0, 4).map((book, i) => (
                    <div key={book._id || i} className="pl-mini-cover" style={{ zIndex: 4 - i }}>
                      {bookCover(book)
                        ? <img src={bookCover(book)} alt="" onError={e => { e.target.style.display = "none"; }} />
                        : <div className="pl-cover-fallback small"><Icon d={ICONS.book} size={14} /></div>
                      }
                    </div>
                  ))}
                  {(pl.books?.length || 0) === 0 && (
                    <div className="pl-card-icon"><Icon d={ICONS.library} size={36} /></div>
                  )}
                </div>
                )}

                <div className="pl-card-body">
                  <div className="pl-card-name">{pl.name}</div>
                  {pl.description && <div className="pl-card-desc">{pl.description}</div>}
                  <div className="pl-card-meta">{pl.books?.length || 0} book{pl.books?.length !== 1 ? "s" : ""}</div>
                </div>

                {/* action buttons */}
                <div className="pl-card-actions" onClick={e => e.stopPropagation()}>
                  <button className="pl-card-action-btn" title="Edit" onClick={() => openEdit(pl)}>
                    <Icon d={ICONS.edit} size={15} />
                  </button>
                  <button className="pl-card-action-btn pl-card-action-btn--danger" title="Delete" onClick={() => openDelete(pl)}>
                    <Icon d={ICONS.trash} size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* modals */}
      {(modal === "create" || modal === "edit") && renderFormModal(modal)}
      {modal === "delete" && renderDeleteModal()}
      {modal === "view" && renderViewModal()}
    </div>
  );
}
