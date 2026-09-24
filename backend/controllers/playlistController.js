const Playlist = require("../models/Playlist");

/* ─── GET /api/playlists — all playlists for the current user ─── */
exports.getPlaylists = async (req, res) => {
  try {
    const playlists = await Playlist.find({ user: req.user._id })
      .populate("books", "title author coverUrl cover price")
      .sort({ updatedAt: -1 });
    res.json({ playlists });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch playlists", error: err.message });
  }
};

/* ─── POST /api/playlists — create a new playlist ─── */
exports.createPlaylist = async (req, res) => {
  try {
    const { name, description, coverColor } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Playlist name is required" });
    }
    const playlist = await Playlist.create({
      user: req.user._id,
      name: name.trim(),
      description: description ? description.trim() : "",
      coverColor: coverColor || "#8b5cf6",
    });
    res.status(201).json({ playlist, message: "Playlist created" });
  } catch (err) {
    res.status(500).json({ message: "Failed to create playlist", error: err.message });
  }
};

/* ─── PUT /api/playlists/:id — update name / description / color ─── */
exports.updatePlaylist = async (req, res) => {
  try {
    const playlist = await Playlist.findOne({ _id: req.params.id, user: req.user._id });
    if (!playlist) return res.status(404).json({ message: "Playlist not found" });

    const { name, description, coverColor } = req.body;
    if (name !== undefined) playlist.name = name.trim();
    if (description !== undefined) playlist.description = description.trim();
    if (coverColor !== undefined) playlist.coverColor = coverColor;

    await playlist.save();
    await playlist.populate("books", "title author coverUrl cover price");
    res.json({ playlist, message: "Playlist updated" });
  } catch (err) {
    res.status(500).json({ message: "Failed to update playlist", error: err.message });
  }
};

/* ─── DELETE /api/playlists/:id — delete a playlist ─── */
exports.deletePlaylist = async (req, res) => {
  try {
    const playlist = await Playlist.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!playlist) return res.status(404).json({ message: "Playlist not found" });
    res.json({ message: "Playlist deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete playlist", error: err.message });
  }
};

/* ─── POST /api/playlists/:id/books/:bookId — add a book ─── */
exports.addBook = async (req, res) => {
  try {
    const playlist = await Playlist.findOne({ _id: req.params.id, user: req.user._id });
    if (!playlist) return res.status(404).json({ message: "Playlist not found" });

    const bookId = req.params.bookId;
    if (playlist.books.map(b => b.toString()).includes(bookId)) {
      return res.status(400).json({ message: "Book already in playlist" });
    }

    playlist.books.push(bookId);
    await playlist.save();
    await playlist.populate("books", "title author coverUrl cover price");
    res.json({ playlist, message: "Book added to playlist" });
  } catch (err) {
    res.status(500).json({ message: "Failed to add book", error: err.message });
  }
};

/* ─── DELETE /api/playlists/:id/books/:bookId — remove a book ─── */
exports.removeBook = async (req, res) => {
  try {
    const playlist = await Playlist.findOne({ _id: req.params.id, user: req.user._id });
    if (!playlist) return res.status(404).json({ message: "Playlist not found" });

    playlist.books = playlist.books.filter(b => b.toString() !== req.params.bookId);
    await playlist.save();
    await playlist.populate("books", "title author coverUrl cover price");
    res.json({ playlist, message: "Book removed from playlist" });
  } catch (err) {
    res.status(500).json({ message: "Failed to remove book", error: err.message });
  }
};
