"use client";
import { useEffect, useState } from "react";

/**
 * Gate for the one heavy 3D moment on the whole site. Deliberately
 * conservative: defaults to false (static fallback) until we've actually
 * confirmed the viewer's environment can take it, rather than defaulting to
 * true and disappointing low-power devices with a janky scene.
 *
 * False when any of:
 * - prefers-reduced-motion is set (respected, not just detected)
 * - viewport is narrow enough to be a phone (small screen = no room for the
 *   scene to read well anyway, and most likely to also be low-power)
 * - navigator.hardwareConcurrency reports a very small core count (a real,
 *   if imperfect, low-power signal - Three.js/WebGL is the one place on
 *   this site that actually taxes the GPU/CPU)
 */
export function useCanRender3D() {
  const [canRender, setCanRender] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isNarrow = window.matchMedia("(max-width: 767px)").matches;
    const lowCoreCount = typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency < 4;

    setCanRender(!reducedMotion && !isNarrow && !lowCoreCount);

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const widthQuery = window.matchMedia("(max-width: 767px)");
    const update = () => {
      setCanRender(
        !motionQuery.matches && !widthQuery.matches &&
        !(typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency < 4)
      );
    };
    motionQuery.addEventListener("change", update);
    widthQuery.addEventListener("change", update);
    return () => {
      motionQuery.removeEventListener("change", update);
      widthQuery.removeEventListener("change", update);
    };
  }, []);

  return canRender;
}
