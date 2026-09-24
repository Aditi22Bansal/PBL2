"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Menu, X } from "lucide-react";
import RoomFitLogo from "./RoomFitLogo";

const LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Students", href: "#students" },
  { label: "Admins", href: "#admins" },
  { label: "Our story", href: "#our-story" },
];

export default function Navbar() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 bg-[#faf9f7]/90 backdrop-blur-md transition-all duration-200 ${
        scrolled ? "border-b border-stone-200 shadow-[0_8px_24px_-12px_rgba(28,25,23,0.15)]" : "border-b border-transparent"
      }`}
    >
      <nav aria-label="Primary" className={`max-w-6xl mx-auto px-5 sm:px-6 flex items-center justify-between transition-all duration-200 ${scrolled ? "h-[56px]" : "h-16"}`}>
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 shrink-0"
          aria-label="RoomFit home"
        >
          <RoomFitLogo className="w-7 h-7" />
          <span className="font-bold text-[16px] tracking-tight text-stone-900">
            RoomFit
          </span>
        </button>

        <div className="hidden md:flex items-center gap-7 text-[14px] font-medium text-stone-600">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-stone-950 transition-colors">
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={() => router.push("/login")}
            className="text-sm font-medium text-stone-600 hover:text-stone-950 px-3 py-2 transition-colors"
          >
            Log in
          </button>
          <button
            onClick={() => router.push("/register")}
            className="btn-primary text-sm font-semibold px-5 py-2.5 rounded-xl"
          >
            Register your institution
          </button>
        </div>

        <button
          className="md:hidden w-10 h-10 rounded-lg flex items-center justify-center text-stone-700 hover:bg-stone-200/60 transition-colors"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {open && (
        <div className="md:hidden px-5 pb-5">
          <div className="card-premium rounded-2xl px-3 pt-2 pb-3 shadow-lift">
            <div className="flex flex-col text-[15px] font-medium text-stone-700">
              {LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="px-3 py-3 rounded-xl hover:bg-stone-100 transition-colors"
                >
                  {l.label}
                </a>
              ))}
            </div>
            <div className="flex gap-3 mt-2 px-1 pb-1">
              <button
                onClick={() => router.push("/login")}
                className="flex-1 text-sm font-semibold px-4 py-3 rounded-xl border border-stone-300 text-stone-800"
              >
                Log in
              </button>
              <button
                onClick={() => router.push("/register")}
                className="btn-primary flex-1 text-sm font-semibold px-4 py-3 rounded-xl"
              >
                Register
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

/** Subtle one-time fade used sparingly below the fold. Renders statically
 *  under reduced motion; content is fully legible without it. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduced ? 0 : 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: reduced ? 0 : 0.4, delay: reduced ? 0 : delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
