"use client";
import { useEffect, useRef, useState } from "react";

/** Animated compatibility-score ring - counts up once scrolled into view. */
export function CompatibilityRing({ score = 92 }: { score?: number }) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setValue(score);
      return;
    }
    let raf: number;
    const start = performance.now();
    const duration = 1100;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setValue(Math.round(score * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, score]);

  const r = 54;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - value / 100);

  return (
    <div ref={ref} className="relative w-36 h-36 mx-auto">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(41,37,36,0.08)" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={r} fill="none" stroke="url(#ringGrad)" strokeWidth="10"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.1s linear" }}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#5eead4" />
            <stop offset="100%" stopColor="#0f766e" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-stone-800">{value}%</span>
        <span className="text-[11px] text-stone-600">compatibility</span>
      </div>
    </div>
  );
}

/** Hard-constraint pre-filter diagram: two absolute gates, then a room - and
 * one deliberately blocked pairing shown crossed out, matching the real
 * behavior in ml_engine/encoder.py's has_hard_conflict(). */
export function ConstraintDiagram() {
  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center justify-between gap-3">
        <PersonChip label="Aisha" ok />
        <Gate label="Same gender" pass />
        <PersonChip label="Neha" ok />
      </div>
      <div className="flex items-center justify-center my-2">
        <div className="w-px h-6 bg-stone-200" />
      </div>
      <div className="flex items-center justify-between gap-3">
        <PersonChip label="Neha" ok />
        <Gate label="Smoking compatible" pass />
        <PersonChip label="Priya" ok />
      </div>
      <div className="mt-4 pt-4 border-t border-stone-200 flex items-center justify-between gap-3 opacity-70">
        <PersonChip label="Priya" ok />
        <Gate label="Smoking compatible" pass={false} />
        <PersonChip label="Tara (smoker)" ok={false} />
      </div>
      <p className="text-xs text-stone-600 mt-4 leading-relaxed">
        A blocked pairing is excluded outright — never outweighed by a high score on
        every other dimension.
      </p>
    </div>
  );
}

function PersonChip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={`px-3 py-2 rounded-xl text-xs font-medium ${ok ? "bg-teal-50 text-teal-800 border border-teal-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
      {label}
    </div>
  );
}

function Gate({ label, pass }: { label: string; pass: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 flex-shrink-0">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${pass ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
        {pass ? "✓" : "✕"}
      </div>
      <span className="text-[10px] text-stone-600 text-center max-w-[76px]">{label}</span>
    </div>
  );
}

/** Notification + chat mock - matches the real Socket.IO notification/chat
 * shapes (join_user room, per-room chat), not an invented UI. */
export function NotificationChatMock() {
  return (
    <div className="glass-card rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3">
        <span className="text-lg">🔔</span>
        <div>
          <p className="text-sm text-stone-800 font-medium">You&apos;ve been placed in Room 204</p>
          <p className="text-xs text-stone-600">Just now</p>
        </div>
      </div>
      <div className="space-y-2 pt-1">
        <ChatBubble mine={false} name="Priya" text="Hi! I'm an early riser, hope that's okay 🙂" />
        <ChatBubble mine name="You" text="No worries at all, same here!" />
      </div>
    </div>
  );
}

function ChatBubble({ mine, name, text }: { mine: boolean; name: string; text: string }) {
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <span className="text-[10px] text-stone-600 mb-1">{name}</span>
      <div className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-sm ${mine ? "bg-teal-700 text-white rounded-br-sm" : "bg-stone-100 text-stone-800 rounded-bl-sm border border-stone-200"}`}>
        {text}
      </div>
    </div>
  );
}

/** Multi-tenant isolation: separate, sealed institution panels - visualizes
 * organizationId scoping (docs/decisions.md #4), not just "many logos." */
export function TenantIsolationVisual() {
  const orgs = [
    { name: "Greenfield University", students: 412, color: "#0f766e" },
    { name: "Lakeside College", students: 268, color: "#c2410c" },
  ];
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {orgs.map((org) => (
        <div key={org.name} className="glass-card rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1" style={{ background: org.color }} />
          <p className="text-xs text-stone-600 mb-1">Institution</p>
          <p className="text-sm font-semibold text-stone-800 mb-3">{org.name}</p>
          <div className="flex items-center gap-2 text-xs text-stone-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {org.students} students · fully isolated
          </div>
        </div>
      ))}
    </div>
  );
}

/** Admin toolset preview - deliberately table-shaped, not a 3D scene, to
 * stay honest about Phase 3's own "admins need scannable tables" constraint
 * even in a marketing mock. */
export function AdminPreview() {
  const rows = [
    { room: "A-204", members: 4, score: 0.94, status: "Locked" },
    { room: "A-205", members: 3, score: 0.88, status: "Active" },
    { room: "B-110", members: 4, score: 0.91, status: "Active" },
  ];
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-stone-800">Allocation overview</p>
        <span className="text-[10px] px-2 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200">CSV export</span>
      </div>
      <div className="space-y-1.5">
        <div className="grid grid-cols-4 gap-2 text-[10px] uppercase tracking-wide text-stone-600 px-2 pb-1">
          <span>Room</span><span>Members</span><span>Score</span><span>Status</span>
        </div>
        {rows.map((r) => (
          <div key={r.room} className="grid grid-cols-4 gap-2 items-center bg-stone-50 hover:bg-stone-100 rounded-lg px-2 py-2 text-xs transition-colors">
            <span className="text-stone-800 font-medium">{r.room}</span>
            <span className="text-stone-600">{r.members}</span>
            <span className="text-teal-700 font-medium">{r.score}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full w-fit ${r.status === "Locked" ? "bg-amber-50 text-amber-800" : "bg-teal-50 text-teal-800"}`}>{r.status}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-stone-600 mt-3">Every action here — lock, swap, sync — is written to an audit log.</p>
    </div>
  );
}
