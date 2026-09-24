import NavBar from "./components/NavBar";
import HeroSection from "./sections/HeroSection";
import { ScrollSmoother, ScrollTrigger } from "gsap/all";
import gsap from "gsap";
import MessageSection from "./sections/MessageSection";
import FlavorSection from "./sections/FlavorSection";
import { useGSAP } from "@gsap/react";
import NutritionSection from "./sections/NutritionSection";
import BenefitSection from "./sections/BenefitSection";
import TestimonialSection from "./sections/TestimonialSection";
import FooterSection from "./sections/FooterSection";
import TopButton from "./components/TopButton";
import { useEffect, useState } from "react";

gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

const App = () => {
  const [isPageReady, setIsPageReady] = useState(false);
  const [isIntroComplete, setIsIntroComplete] = useState(false);

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    window.scrollTo(0, 0);

    const resetOnReload = () => {
      window.scrollTo(0, 0);
    };

    const handleReady = () => {
      setIsPageReady(true);
    };

    window.addEventListener("beforeunload", resetOnReload);

    if (document.readyState !== "loading") {
      requestAnimationFrame(handleReady);
    } else {
      document.addEventListener("DOMContentLoaded", handleReady, { once: true });
    }

    return () => {
      window.removeEventListener("beforeunload", resetOnReload);
      document.removeEventListener("DOMContentLoaded", handleReady);
    };
  }, []);

  useGSAP(() => {
    if (!isPageReady) return;

    ScrollTrigger.config({
      ignoreMobileResize: true,
      autoRefreshEvents: "visibilitychange,DOMContentLoaded,load",
    });

    const existingSmoother = ScrollSmoother.get();
    if (existingSmoother) {
      existingSmoother.kill();
    }

    const smoother = ScrollSmoother.create({
      smooth: 0.9,
      smoothTouch: 0.12,
      effects: false,
      normalizeScroll: true,
    });

    smoother.paused(!isIntroComplete);

    smoother.scrollTo(0, false);

    const refreshAfterLoad = () => {
      requestAnimationFrame(() => {
        ScrollTrigger.refresh();
      });
    };

    if (document.readyState === "complete") {
      refreshAfterLoad();
    } else {
      window.addEventListener("load", refreshAfterLoad, { once: true });
    }

    return () => {
      window.removeEventListener("load", refreshAfterLoad);
      smoother.kill();
    };
  }, [isPageReady]);

  useEffect(() => {
    const smoother = ScrollSmoother.get();
    if (smoother) {
      smoother.paused(!isIntroComplete);
    }
  }, [isIntroComplete]);

  return (
    <main>
      <NavBar />
      <TopButton />
      <div id="smooth-wrapper">
        <div id="smooth-content">
          <HeroSection 
            onIntroComplete={() => setIsIntroComplete(true)} 
            isIntroComplete={isIntroComplete} 
          />
          <MessageSection />
          <FlavorSection />
          <NutritionSection />

          <div>
            <BenefitSection />
            <TestimonialSection />
          </div>

          <FooterSection />
        </div>
      </div>
    </main>
  );
};

export default App;
