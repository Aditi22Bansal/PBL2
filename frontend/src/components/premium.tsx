"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

/** Small premium pill badge with a live dot. Purely presentational. */
export function EyebrowBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="eyebrow-badge">
      <span className="dot" aria-hidden="true" />
      {children}
    </span>
  );
}

/** Subtle CSS float wrapper. Static under reduced motion. */
export function Float({
  children,
  slow = false,
  delay = "0s",
  className = "",
}: {
  children: React.ReactNode;
  slow?: boolean;
  delay?: string;
  className?: string;
}) {
  return (
    <div
      className={`${slow ? "animate-float-slow" : "animate-float"} ${className}`}
      style={{ animationDelay: delay }}
    >
      {children}
    </div>
  );
}

/** Number that counts up once when it enters the viewport.
 *  Renders the final value immediately under reduced motion or SSR. */
export function CountUp({
  value,
  suffix = "",
  duration = 1.1,
  className = "",
}: {
  value: number;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      // No animation — jump to the final value on the next frame.
      const frame = requestAnimationFrame(() => setDisplay(value));
      return () => cancelAnimationFrame(frame);
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(eased * value));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, reduced, value, duration]);

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {display}
      {suffix}
    </span>
  );
}

/** Compatibility ring that draws itself on viewport entry. */
export function AnimatedRing({
  score = 92,
  size = 128,
  stroke = 11,
  label = "compatibility",
}: {
  score?: number;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const r = 54;
  const circumference = 2 * Math.PI * r;
  const reduced = useReducedMotion();
  return (
    <div style={{ width: size, height: size }} className="mx-auto relative">
      <svg
        viewBox="0 0 120 120"
        className="w-full h-full -rotate-90"
        role="img"
        aria-label={`${score} percent ${label}`}
      >
        <circle cx="60" cy="60" r={r} fill="none" className="ring-track" strokeWidth={stroke} />
        <motion.circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#16655f"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          whileInView={{ strokeDashoffset: circumference * (1 - score / 100) }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: reduced ? 0 : 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[26px] font-bold tracking-tight text-stone-900">
          <CountUp value={score} suffix="%" />
        </span>
        <span className="text-[11px] text-stone-600">{label}</span>
      </div>
    </div>
  );
}
