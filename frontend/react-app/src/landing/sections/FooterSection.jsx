import { useEffect, useRef } from "react";
import { useMediaQuery } from "react-responsive";

const ASSET_VERSION = "20260316-2";

const FooterSection = () => {
  const isMobile = useMediaQuery({
    query: "(max-width: 768px)",
  });

  const videoRef = useRef(null);
  const hasPlayedRef = useRef(false);

  useEffect(() => {
    if (isMobile) return;

    const videoEl = videoRef.current;
    if (!videoEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasPlayedRef.current) {
            hasPlayedRef.current = true;
            videoEl.currentTime = 0;
            const playPromise = videoEl.play();
            if (playPromise?.catch) {
              playPromise.catch(() => {});
            }
            observer.disconnect();
          }
        });
      },
      { threshold: 0.35, rootMargin: "0px 0px -10% 0px" }
    );

    observer.observe(videoEl);

    return () => {
      observer.disconnect();
    };
  }, [isMobile]);

  return (
    <section className="footer-section">
      <img
        src="/images/footer-dip.png"
        alt=""
        className="w-full object-cover -translate-y-1"
      />

      <div className="2xl:h-[110dvh] relative md:pt-[20vh] pt-[10vh]">
        <div className="overflow-hidden z-10">
          <h1 className="general-title text-center text-milk py-5">
            #READWITHREADIFY
          </h1>
        </div>

        {isMobile ? (
          <img
            src="/images/footer-drink.png"
            className="absolute top-0 object-contain"
          />
        ) : (
          <video
            ref={videoRef}
            src={`/videos/splash.mp4?v=${ASSET_VERSION}`}
            playsInline
            muted
            preload="metadata"
            className="absolute top-0 object-contain mix-blend-lighten"
          />
        )}

        <div className="flex-center gap-5 relative z-10 md:mt-20 mt-5">
          <div className="social-btn">
            <img src="./images/yt.svg" alt="" />
          </div>
          <div className="social-btn">
            <img src="./images/insta.svg" alt="" />
          </div>
          <div className="social-btn">
            <img src="./images/tiktok.svg" alt="" />
          </div>
        </div>

        <div className="mt-40 md:px-10 px-5 flex gap-10 md:flex-row flex-col justify-between text-milk font-paragraph md:text-lg font-medium">
          <div className="flex items-center md:gap-16 gap-5">
            <div>
              <p>Readify Catalog</p>
            </div>
            <div>
              <p>Book Clubs</p>
              <p>Student Access</p>
              <p>Library Partners</p>
            </div>
            <div>
              <p>Company</p>
              <p>Support</p>
              <p>Reader Stories</p>
            </div>
          </div>

          <div className="md:max-w-lg">
            <p>
              Get early access to featured collections, reading events, and
              personalized recommendations.
            </p>
            <div className="flex justify-between items-center border-b border-[#D9D9D9] py-5 md:mt-10">
              {/* The input field and arrow icon for newsletter signup. */}{" "}
              {/* A
          border at the bottom for a clean, modern look. */}
              <input
                type="email"
                placeholder="Enter your email"
                className="w-full placeholder:font-sans placeholder:text-[#999999]"
              />
              <img src="/images/arrow.svg" alt="arrow" />
            </div>
          </div>
        </div>

        <div className="copyright-box">
          {/* The final row with copyright and legal links. */}
          <p>Copyright © 2026 Readify - All Rights Reserved</p>
          <div className="flex items-center gap-7">
            <p>Privacy Policy</p>
            <p>Terms of Service</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FooterSection;
