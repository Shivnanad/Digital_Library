import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { SplitText } from "gsap/all";
import { useMediaQuery } from "react-responsive";
import { useEffect, useRef, useState } from "react";

import { useNavigate } from "react-router-dom";

const ASSET_VERSION = "20260316-2";

const HeroSection = ({ onIntroComplete = () => {}, isIntroComplete = false }) => {
  const videoRef = useRef(null);
  const navigate = useNavigate();

  const handleEnterLibrary = () => {
    navigate("/app");
  };

  const isMobile = useMediaQuery({
    query: "(max-width: 768px)",
  });

  const isTablet = useMediaQuery({
    query: "(max-width: 1024px)",
  });

  useEffect(() => {
    if (isTablet) {
      onIntroComplete();
    } else {
      const videoEl = videoRef.current;
      if (!videoEl) return;

      videoEl.currentTime = 0; // Force start from beginning
      const playPromise = videoEl.play();
      if (playPromise?.catch) {
        playPromise.catch(() => {
          onIntroComplete(); // Call complete if autoplay blocked
        });
      }
    }
  }, [isTablet]);

  useGSAP(() => {
    if (!isIntroComplete) return;

    const titleSplit = SplitText.create(".hero-title", {
      type: "words,chars",
    });

    const tl = gsap.timeline();

    tl.to(".hero-content", {
      opacity: 1,
      y: 0,
      ease: "power1.inOut",
      force3D: true,
    })
      .to(
        ".hero-text-scroll",
        {
          duration: 1,
          clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
          ease: "circ.out",
        },
        "-=0.5"
      )
      .from(
        titleSplit.chars,
        {
          yPercent: 200,
          stagger: 0.02,
          ease: "power2.out",
          force3D: true,
        },
        "-=0.5"
      );

    const heroTl = gsap.timeline({
      scrollTrigger: {
        trigger: ".hero-container",
        start: "1% top",
        end: "bottom top",
        scrub: true,
      },
    });
    heroTl.to(".hero-container", {
      rotate: 7,
      scale: 0.9,
      yPercent: 30,
      ease: "power1.inOut",
    });

    return () => {
      titleSplit.revert();
      tl.kill();
      heroTl.kill();
    };
  }, [isIntroComplete]);

  return (
    <section className="bg-milk">
      <div className="hero-container">
        {isTablet ? (
          <>
            {isMobile && (
              <img
                src="/images/hero-bg.png"
                className="absolute bottom-40 size-full object-cover"
              />
            )}
            <img
              src="/images/hero-img.png"
              className="absolute bottom-0 left-1/2 -translate-x-1/2 object-auto"
            />
          </>
        ) : (
          <video
            ref={videoRef}
            src={`/videos/hero-bg.mp4?v=${ASSET_VERSION}`}
            muted
            playsInline
            preload="auto"
            onEnded={onIntroComplete}
            onError={onIntroComplete}
            className="absolute inset-0 w-full h-full object-cover z-0"
          />
        )}
        <div className="hero-content opacity-0 relative z-10">
          <div className="overflow-hidden">
            <h1 className="hero-title whitespace-nowrap">Read Anywhere</h1>
          </div>
          <div
            style={{
              clipPath: "polygon(50% 0, 50% 0, 50% 100%, 50% 100%)",
            }}
            className="hero-text-scroll"
          >
            <div className="hero-subtitle">
              <h1>Books + Audiobooks</h1>
            </div>
          </div>

          <h2>
            Discover your next favorite story with Readify and enjoy curated
            digital shelves for every mood, age, and interest.
          </h2>

          <div
            className="hero-button"
            role="button"
            tabIndex={0}
            onClick={handleEnterLibrary}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleEnterLibrary();
              }
            }}
          >
            <p>Enter Library</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
