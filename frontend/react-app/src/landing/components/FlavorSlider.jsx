import { useGSAP } from "@gsap/react";
import { flavorlists } from "../constants";
import gsap from "gsap";
import { useRef } from "react";
import { useMediaQuery } from "react-responsive";

const ASSET_VERSION = "20260316";

const FlavorSlider = () => {
  const sliderRef = useRef();

  const handleDrinkImageError = (e) => {
    const fallbackExtensions = ["png", "jpg", "jpeg"];
    const currentAttempt = Number(e.currentTarget.dataset.attempt || "0");
    const color = e.currentTarget.dataset.color;

    if (currentAttempt < fallbackExtensions.length) {
      const ext = fallbackExtensions[currentAttempt];
      e.currentTarget.dataset.attempt = String(currentAttempt + 1);
      e.currentTarget.src = `/images/${color}-drink.${ext}?v=${ASSET_VERSION}`;
      return;
    }

    e.currentTarget.style.display = "none";
  };

  const isTablet = useMediaQuery({
    query: "(max-width: 1024px)",
  });

  useGSAP(() => {
    const scrollAmount = sliderRef.current.scrollWidth - window.innerWidth;

    if (!isTablet) {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: ".flavor-section",
          start: "2% top",
          end: `+=${scrollAmount + 1500}px`,
          scrub: true,
          pin: true,
        },
      });

      tl.to(".flavor-section", {
        x: `-${scrollAmount + 1500}px`,
        ease: "power1.inOut",
      });
    }

    const titleTl = gsap.timeline({
      scrollTrigger: {
        trigger: ".flavor-section",
        start: "top top",
        end: "bottom 80%",
        scrub: true,
      },
    });

    titleTl
      .to(".first-text-split", {
        xPercent: -30,
        ease: "power1.inOut",
      })
      .to(
        ".flavor-text-scroll",
        {
          xPercent: -22,
          ease: "power1.inOut",
        },
        "<"
      )
      .to(
        ".second-text-split",
        {
          xPercent: -10,
          ease: "power1.inOut",
        },
        "<"
      );
  }, [isTablet]);

  return (
    <div ref={sliderRef} className="slider-wrapper">
      <div className="flavors">
        {flavorlists.map((flavor) => (
          <div
            key={flavor.name}
            className={`relative z-30 lg:w-[50vw] w-96 lg:h-[70vh] md:w-[90vw] md:h-[50vh] h-80 flex-none ${flavor.rotation}`}
          >
            <img
              src={`/images/${flavor.color}-bg.svg?v=${ASSET_VERSION}`}
              alt=""
              className="absolute bottom-0"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />

            <img
              src={`/images/${flavor.color}-drink.webp?v=${ASSET_VERSION}`}
              alt=""
              className="drinks"
              data-color={flavor.color}
              data-attempt="0"
              onError={handleDrinkImageError}
            />

            <img
              src={`/images/${flavor.color}-elements.webp?v=${ASSET_VERSION}`}
              alt=""
              className="elements"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />

            <h1>{flavor.name}</h1>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FlavorSlider;
