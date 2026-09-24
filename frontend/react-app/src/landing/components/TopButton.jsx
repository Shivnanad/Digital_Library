import { useEffect, useState } from "react";
import { ScrollSmoother } from "gsap/all";

const TopButton = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 500);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    const smoother = ScrollSmoother.get();

    if (smoother) {
      smoother.scrollTo(0, true);
      return;
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <button
      type="button"
      aria-label="Scroll to top"
      onClick={scrollToTop}
      className={`fixed right-4 md:right-8 bottom-6 md:bottom-10 z-[60] rounded-full border border-[#52312233] bg-[#faeadee6] px-4 py-3 text-sm md:text-base uppercase tracking-wide text-[#523122] shadow-[0_8px_30px_rgba(82,49,34,0.18)] transition-all duration-300 hover:-translate-y-1 hover:bg-[#e3a458] hover:text-[#222123] ${
        isVisible
          ? "pointer-events-auto opacity-100 translate-y-0"
          : "pointer-events-none opacity-0 translate-y-4"
      }`}
    >
      Top
    </button>
  );
};

export default TopButton;