import { Link } from "react-router-dom";

const NavBar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 md:p-9 p-3 flex justify-between items-center pointer-events-none">
      <Link to="/" className="pointer-events-auto group" title="Return to Digital Library">
        <h1 className="md:text-5xl text-3xl font-bold italic text-dark-brown tracking-tight transition-transform group-hover:scale-105">
          Readify
        </h1>
      </Link>
      <Link
        to="/"
        className="pointer-events-auto inline-flex items-center gap-2 bg-dark-brown text-[#faeade] font-semibold text-sm md:text-base px-4 py-2 md:px-6 md:py-2.5 rounded-full shadow-lg hover:bg-[#a26833] transition-all duration-300 transform hover:scale-105"
      >
        <span>Open Library</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </Link>
    </nav>
  );
};

export default NavBar;

