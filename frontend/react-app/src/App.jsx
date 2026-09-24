import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { WishlistProvider } from "./context/WishlistContext";
import { VoiceProvider } from "./context/VoiceContext";
import Navbar from "./components/Navbar";
import VoiceControl from "./components/VoiceControl";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import BookDetails from "./pages/BookDetails";
import CoverPage from "./pages/CoverPage";
import Cart from "./pages/Cart";
import Trending from "./pages/Trending";
import NewReleases from "./pages/NewReleases";
import Categories from "./pages/Categories";
import AdminDashboard from "./pages/AdminDashboard";
import AdminBooks from "./pages/AdminBooks";
import AdminBookEdit from "./pages/AdminBookEdit";
import RequireAuth from "./components/RequireAuth";
import RequireAuthUser from "./components/RequireAuthUser";
import UserPanel from "./pages/UserPanel";
import AdminPanel from "./pages/AdminPanel";
import Checkout from "./pages/Checkout";
import Account from "./pages/Account";
import Wishlist from "./pages/Wishlist";
import Playlists from "./pages/Playlists";
import SearchResults from "./pages/SearchResults";
import ReadBook from "./pages/ReadBook";
import ReadingHistory from "./pages/ReadingHistory";
import MyLibrary from "./pages/MyLibrary";
import Onboarding from "./pages/Onboarding";
import LandingPage from "./landing/LandingPage";

export default function App() {
  /* Scroll to top on every route change */
  function ScrollToTop() {
    const { pathname } = useLocation();
    useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
    return null;
  }

  function AppContent() {
    const location = useLocation();
    const hideNavbar = location.pathname === "/" || location.pathname === "/login" || location.pathname === "/register" || location.pathname === "/onboarding" || location.pathname.startsWith("/read/");

    return (
      <div className="app">
        {!hideNavbar && <Navbar />}
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/app" element={<Home />} />
          <Route path="/home" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/book/:id" element={<BookDetails />} />
          <Route path="/book/:id/cover" element={<CoverPage />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/account" element={<Account />} />
          <Route path="/trending" element={<Trending />} />
          <Route path="/new-releases" element={<NewReleases />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/playlists" element={<Playlists />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/reading-history" element={<ReadingHistory />} />
          <Route path="/my-library" element={<MyLibrary />} />
          <Route path="/read/:id" element={<ReadBook />} />

          {/* Admin routes (protected) */}
          <Route path="/admin" element={<RequireAuth><AdminDashboard/></RequireAuth>} />
          <Route path="/admin/books" element={<RequireAuth><AdminBooks/></RequireAuth>} />
          <Route path="/admin/books/:id" element={<RequireAuth><AdminBookEdit/></RequireAuth>} />
          <Route path="/admin/users" element={<RequireAuth><AdminPanel/></RequireAuth>} />
          <Route path="/admin/panel" element={<RequireAuth><AdminPanel/></RequireAuth>} />
          <Route path="/user/panel" element={<RequireAuthUser><UserPanel/></RequireAuthUser>} />
        </Routes>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <ScrollToTop />
      <WishlistProvider>
        <VoiceProvider>
          <AppContent />
          <VoiceControl />
        </VoiceProvider>
      </WishlistProvider>
    </BrowserRouter>
  );
}

