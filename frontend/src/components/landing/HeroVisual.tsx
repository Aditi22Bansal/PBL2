"use client";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import { useCanRender3D } from "./useCanRender3D";
import HeroSceneFallback from "./HeroSceneFallback";

// Code-split: the whole three/@react-three bundle only downloads for viewers
// who both get past useCanRender3D's gate AND actually render this component
// - it's never in the main landing-page chunk, and ssr:false keeps it off
// the server-rendered HTML entirely (WebGL has no meaning server-side).
const HeroScene3D = dynamic(() => import("./HeroScene3D"), {
  ssr: false,
  loading: () => <HeroSceneFallback />,
});

export default function HeroVisual() {
  const canRender3D = useCanRender3D();

  return (
    <div className="relative w-full aspect-square max-w-xl mx-auto">
      <div className="absolute inset-0 rounded-[32px] overflow-hidden">
        {canRender3D ? (
          <Suspense fallback={<HeroSceneFallback />}>
            <HeroScene3D />
          </Suspense>
        ) : (
          <HeroSceneFallback />
        )}
      </div>

      {/* Floating glass info-cards - sell the product's real output at a
          glance. Numbers here are illustrative UI examples (matching the
          shape of a real /allocate/v2 room + compatibility_score, not a
          claimed aggregate research statistic).

          Only the match-score badge shows on narrow phones - three
          overlapping absolutely-positioned cards on a small square visual
          crowded and clipped each other rather than reading as "floating."
          Same principle as the 3D->static fallback: a clean, simpler mobile
          view beats a cluttered attempt at the full desktop composition. */}
      <div className="hidden sm:block absolute left-2 top-[14%] glass-card rounded-2xl px-4 py-3 shadow-xl shadow-stone-900/10 animate-[float_6s_ease-in-out_infinite]">
        <p className="text-[10px] uppercase tracking-wider text-stone-600 font-medium">Room 204</p>
        <p className="text-sm font-semibold text-stone-800 mt-0.5">4 beds · Block A</p>
      </div>

      <div
        className="absolute right-1 top-[6%] sm:right-0 sm:top-[8%] glass-card rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 shadow-xl shadow-stone-900/10 animate-[float_7s_ease-in-out_infinite]"
        style={{ animationDelay: "1.2s" }}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-[10px] sm:text-[11px] font-bold text-white flex-shrink-0">98%</div>
          <div>
            <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-stone-600 font-medium">Match score</p>
            <p className="text-[11px] sm:text-xs font-medium text-stone-700">Great fit</p>
          </div>
        </div>
      </div>

      <div
        className="hidden sm:block absolute left-[6%] bottom-[10%] glass-card rounded-2xl px-4 py-3 shadow-xl shadow-stone-900/10 animate-[float_5.5s_ease-in-out_infinite]"
        style={{ animationDelay: "0.6s" }}
      >
        <div className="flex -space-x-2">
          {["A", "P", "N"].map((letter, i) => (
            <div
              key={letter}
              className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-semibold text-white"
              style={{ background: ["#0f766e", "#c2410c", "#57534e"][i] }}
            >
              {letter}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-stone-600 mt-1.5">3 roommates matched</p>
      </div>
    </div>
  );
}
