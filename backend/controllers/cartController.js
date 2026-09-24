const User = require("../models/User");
const Book = require("../models/Book");

// ADD BOOK TO CART
const addToCart = async (req, res) => {
  try {
    const { userId, bookId } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ message: "Book not found" });

    const existingItem = user.cart.find(
      (item) => item.book.toString() === bookId
    );

    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      user.cart.push({ book: bookId, quantity: 1 });
    }

    await user.save();
    res.json({ message: "Book added to cart", cart: user.cart });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET USER CART
const getCart = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate("cart.book", "title author pdfUrl");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user.cart);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// REMOVE BOOK FROM CART
const removeFromCart = async (req, res) => {
  try {
    const { userId, bookId } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.cart = user.cart.filter(
      (item) => item.book.toString() !== bookId
    );

    await user.save();
    res.json({ message: "Book removed from cart", cart: user.cart });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  addToCart,
  getCart,
  removeFromCart
};
