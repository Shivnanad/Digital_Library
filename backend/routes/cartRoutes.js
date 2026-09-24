const express = require("express");
const router = express.Router();

const {
  addToCart,
  getCart,
  removeFromCart
} = require("../controllers/cartController");

router.post("/add", addToCart);
router.get("/:userId", getCart);
router.post("/remove", removeFromCart);

module.exports = router;
