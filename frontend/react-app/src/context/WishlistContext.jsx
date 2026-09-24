import React, { createContext, useContext, useEffect, useState } from "react";

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const [wishlist, setWishlist] = useState(() => {
    try {
      const raw = localStorage.getItem("wishlist");
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("wishlist", JSON.stringify(wishlist));
    } catch (err) {
      // ignore
    }
  }, [wishlist]);

  const addToWishlist = (book) => {
    if (!book || !book._id) return;
    setWishlist((prev) => {
      if (prev.find((b) => b._id === book._id)) return prev;
      const copy = JSON.parse(JSON.stringify(book));
      return [...prev, copy];
    });
  };

  const removeFromWishlist = (id) => {
    setWishlist((prev) => prev.filter((b) => b._id !== id));
  };

  const clearWishlist = () => {
    setWishlist([]);
  };

  return (
    <WishlistContext.Provider value={{ wishlist, addToWishlist, removeFromWishlist, clearWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
