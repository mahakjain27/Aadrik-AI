import { useEffect, useRef, useState } from "react";

// One-shot scroll reveal: flips true the first time the element enters the
// viewport, then stops observing (site is a marketing page, not a place
// where re-triggering on scroll-back-up reads as polished).
export function useScrollReveal(options) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(node);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px", ...options }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [options]);

  return [ref, isVisible];
}
