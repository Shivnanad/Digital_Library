const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middlewares/authMiddleware");
const {
  getPlaylists,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  addBook,
  removeBook,
} = require("../controllers/playlistController");

router.use(requireAuth);

router.get("/", getPlaylists);
router.post("/", createPlaylist);
router.put("/:id", updatePlaylist);
router.delete("/:id", deletePlaylist);
router.post("/:id/books/:bookId", addBook);
router.delete("/:id/books/:bookId", removeBook);

module.exports = router;
