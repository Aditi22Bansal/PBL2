"use client";

import dynamic from "next/dynamic";
import { Component } from "react";
import { BedDouble, BookOpen, Moon, Sparkles } from "lucide-react";
import { AnimatedRing, Float } from "@/components/premium";
import type { DollhouseBed } from "./DollhouseRoom";

const RoomScene3D = dynamic(() => import("./DollhouseRoom"), {
  ssr: false,
  loading: () => (
    <div className="h-[300px] sm:h-[360px] flex items-center justify-center" aria-hidden="true">
      <span className="w-12 h-12 rounded-2xl teal-band flex items-center justify-center animate-pulse">
        <BedDouble className="w-6 h-6 text-white" />
      </span>
    </div>
  ),
});

// Example occupants mirror the header below (3-bed, fully occupied) so the
// model and the copy always agree. Beds render 1:1 from this array.
const EXAMPLE_BEDS: DollhouseBed[] = [
  {
    occupied: true,
    occupant: {
      name: "Ananya",
      detail: "CSE · Year 2",
      compat: 98,
      traits: ["Sleep 11pm–7am", "Tidy", "Quiet hours"],
    },
  },
  {
    occupied: true,
    occupant: {
      name: "Priya",
      detail: "CSE · Year 2",
      compat: 96,
      traits: ["Sleep 11pm–7am", "Tidy", "Early riser"],
    },
  },
  {
    occupied: true,
    occupant: {
      name: "Neha",
      detail: "CSE · Year 2",
      compat: 91,
      traits: ["Quiet hours", "Balanced social"],
    },
  },
];

/** If WebGL is unavailable, fall back to a calm static panel. */
class SceneBoundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="h-[300px] sm:h-[340px] flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-white to-stone-50">
          <span className="w-12 h-12 rounded-2xl teal-band flex items-center justify-center">
            <BedDouble className="w-6 h-6 text-white" />
          </span>
          <p className="text-[13px] font-semibold text-stone-600">Room 204 · Block A · 98% match</p>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Hero product composition — one cohesive visualization of RoomFit's
 * matching system: a stylized room, two matched roommate cards, the
 * compatibility behind them, and the room it led to.
 *
 * Clearly an illustrative example of real output shapes (room card,
 * profile rows, match score, lifestyle pills). CSS float only, no
 * heavy assets, stable under reduced motion.
 */
export default function HeroVisual() {
  return (
    <div
      role="img"
      aria-label="Illustration of a RoomFit match: roommates Ananya and Priya paired at 98 percent compatibility into Room 204 based on shared sleep, cleanliness and study habits."
      className="relative mx-auto w-full max-w-[520px] px-6 pt-10 pb-8 sm:px-10"
    >
      {/* soft backdrop */}
      <div aria-hidden="true" className="absolute inset-0 rounded-[32px] hero-wash border border-stone-200/70" />
      <div aria-hidden="true" className="absolute -top-8 -right-6 w-40 h-40 rounded-full bg-amber-200/30 blur-2xl" />
      <div aria-hidden="true" className="absolute -bottom-10 -left-8 w-48 h-48 rounded-full bg-teal-200/30 blur-2xl" />

      {/* floating roommate card — top left */}
      <Float className="absolute left-0 sm:left-2 top-2 z-20" delay="0.8s">
        <div className="card-premium rounded-2xl px-3.5 py-3 flex items-center gap-2.5 w-[172px] sm:w-[196px]">
          <span className="w-9 h-9 rounded-full bg-teal-800 text-white flex items-center justify-center text-[13px] font-bold shrink-0" aria-hidden="true">A</span>
          <span className="min-w-0">
            <span className="block text-[13px] font-bold text-stone-900 truncate">Ananya</span>
            <span className="block text-[11px] text-stone-500 truncate">CSE · Year 2</span>
          </span>
          <span className="chip chip-teal ml-auto shrink-0">98%</span>
        </div>
      </Float>

      {/* floating match badge — top right */}
      <Float slow className="absolute right-0 sm:right-2 top-0 z-20" delay="1.6s">
        <div className="card-premium rounded-2xl px-4 py-3 text-center">
          <p className="text-[20px] font-bold text-teal-900 leading-none tabular-nums">98%</p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 mt-1">Match</p>
        </div>
      </Float>

      {/* central room card */}
      <div className="relative z-10 card-premium rounded-[24px] overflow-hidden mt-6">
        <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl teal-band text-white flex items-center justify-center shadow-soft" aria-hidden="true">
            <BedDouble className="w-5 h-5" />
          </span>
          <div>
            <p className="text-[15px] font-bold text-stone-900 leading-none">Room 204 · Block A</p>
            <p className="text-[12px] text-stone-500 mt-1">3-bed · quiet floor · 3 of 3 filled</p>
          </div>
          <span className="ml-auto text-[11px] font-semibold text-stone-500 border border-stone-200 rounded-full px-2.5 py-1 shrink-0">Example</span>
        </div>

        {/* Dollhouse room — data-driven: 4 beds, 3 occupied, 1 empty */}
        <div className="px-2 sm:px-3 bg-gradient-to-b from-white to-stone-50">
          <SceneBoundary>
            <RoomScene3D beds={EXAMPLE_BEDS} />
          </SceneBoundary>
        </div>

        <div className="px-5 py-3.5 border-t border-stone-100 flex flex-wrap gap-1.5">
          <span className="chip chip-teal"><Moon className="w-3 h-3" aria-hidden="true" /> 11pm – 7am</span>
          <span className="chip chip-teal"><Sparkles className="w-3 h-3" aria-hidden="true" /> Tidy</span>
          <span className="chip chip-amber"><BookOpen className="w-3 h-3" aria-hidden="true" /> Quiet hours</span>
        </div>
      </div>

      {/* floating roommate card — bottom right, clear of the chips strip */}
      <Float className="absolute right-0 sm:right-2 bottom-28 z-20" delay="2.4s">
        <div className="card-premium rounded-2xl px-3.5 py-3 flex items-center gap-2.5 w-[184px] sm:w-[208px]">
          <span className="w-9 h-9 rounded-full bg-amber-100 border border-amber-200 text-amber-900 flex items-center justify-center text-[13px] font-bold shrink-0" aria-hidden="true">P</span>
          <span className="min-w-0">
            <span className="block text-[13px] font-bold text-stone-900 truncate">Priya</span>
            <span className="block text-[11px] text-stone-500 truncate">Quiet study · Balanced</span>
          </span>
        </div>
      </Float>

      {/* floating ring — bottom left, clear of the chips strip */}
      <Float slow className="absolute left-0 sm:left-2 bottom-28 z-20 hidden min-[400px]:block" delay="0.2s">
        <div className="card-premium rounded-2xl p-2.5">
          <AnimatedRing score={98} size={76} stroke={10} label="match" />
        </div>
      </Float>
    </div>
  );
}
