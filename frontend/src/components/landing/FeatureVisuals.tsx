"use client";
import { BedDouble, BookOpen, Moon, Sparkles, Users } from "lucide-react";
import { AnimatedRing } from "@/components/premium";

/** Compatibility score — draws itself on viewport entry, counts up once.
 *  Same export shape as before; the number remains the point. */
export function CompatibilityRing({ score = 92 }: { score?: number }) {
  return <AnimatedRing score={score} size={128} stroke={10} />;
}

/**
 * Match summary — a realistic rendering of what RoomFit actually produces:
 * two profiles, the shared factors behind the score, the room it led to.
 * Plain table-like structure, no decoration.
 */
export function MatchFlow() {
  const factors = [
    { icon: Moon, label: "Sleep schedule", detail: "Both 11pm – 7am" },
    { icon: Sparkles, label: "Cleanliness", detail: "Both prefer tidy" },
    { icon: BookOpen, label: "Study habits", detail: "Both want quiet hours" },
    { icon: Users, label: "Social", detail: "Both balanced" },
  ];
  return (
    <div className="card-premium rounded-[20px] overflow-hidden shadow-soft">
      <div className="px-5 sm:px-6 py-4 border-b border-stone-200 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Match result</p>
          <p className="text-[15px] font-bold text-stone-900 mt-0.5">Ananya × Priya</p>
        </div>
        <span className="text-sm font-bold text-teal-900 bg-teal-50 border border-teal-200 rounded-md px-2.5 py-1">98%</span>
      </div>

      <div className="px-5 sm:px-6 py-4 grid grid-cols-2 gap-3 border-b border-stone-100">
        {[
          { name: "Ananya", tag: "CSE · Year 2 · Early riser", initial: "A" },
          { name: "Priya", tag: "CSE · Year 2 · Quiet study", initial: "P" },
        ].map((p) => (
          <div key={p.name} className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-teal-800 text-white flex items-center justify-center text-[13px] font-bold shrink-0">
              {p.initial}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-stone-900 truncate">{p.name}</p>
              <p className="text-[11px] text-stone-500 truncate">{p.tag}</p>
            </div>
          </div>
        ))}
      </div>

      <ul className="divide-y divide-stone-100">
        {factors.map((f) => (
          <li key={f.label} className="px-5 sm:px-6 py-2.5 flex items-center gap-3">
            <f.icon className="w-4 h-4 text-teal-800 shrink-0" />
            <span className="text-[13px] font-semibold text-stone-800">{f.label}</span>
            <span className="text-[12px] text-stone-500 ml-auto text-right">{f.detail}</span>
          </li>
        ))}
      </ul>

      <div className="px-5 sm:px-6 py-4 bg-stone-50 border-t border-stone-200 flex items-center gap-3">
        <BedDouble className="w-4 h-4 text-stone-500 shrink-0" />
        <p className="text-[13px] text-stone-700">
          Assigned <span className="font-bold text-stone-900">Room 204 · Block A</span>
          <span className="text-stone-500"> — 4-bed, quiet floor</span>
        </p>
      </div>
    </div>
  );
}

/** Hard-constraint pre-filter: two passing gates and one blocked pairing,
 *  matching ml_engine/encoder.py's has_hard_conflict(). Rendered as a plain
 *  checklist, not a diagram. */
export function ConstraintDiagram() {
  const rows = [
    { a: "Aisha", gate: "Same gender", pass: true, b: "Neha" },
    { a: "Neha", gate: "Smoking compatible", pass: true, b: "Priya" },
    { a: "Priya", gate: "Smoking compatible", pass: false, b: "Tara (smoker)" },
  ];
  return (
    <div className="card-premium rounded-[20px] overflow-hidden shadow-soft">
      <div className="px-5 py-3.5 border-b border-stone-200">
        <p className="text-[13px] font-bold text-stone-900">Pre-allocation checks</p>
      </div>
      <ul className="divide-y divide-stone-100">
        {rows.map((r) => (
          <li key={r.a + r.b} className="px-5 py-3 flex items-center gap-2 text-[13px]">
            <span className="font-semibold text-stone-800">{r.a}</span>
            <span className="text-stone-400">→</span>
            <span className={`inline-flex items-center gap-1.5 font-medium ${r.pass ? "text-teal-800" : "text-red-700"}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${r.pass ? "bg-teal-800 text-white" : "bg-stone-800 text-white"}`}>
                {r.pass ? "✓" : "✕"}
              </span>
              {r.gate}
            </span>
            <span className="text-stone-400">→</span>
            <span className="font-semibold text-stone-800">{r.b}</span>
          </li>
        ))}
      </ul>
      <p className="px-5 py-3.5 text-[12px] text-stone-600 leading-relaxed border-t border-stone-200 bg-stone-50">
        A blocked pairing is excluded before matching runs — never outweighed by
        a high score elsewhere.
      </p>
    </div>
  );
}

/** Notification + chat example — matches the real Socket.IO shapes
 *  (join_user room, per-room chat). */
export function NotificationChatMock() {
  return (
    <div className="card-premium rounded-[20px] overflow-hidden shadow-soft">
      <div className="px-5 py-3.5 border-b border-stone-200 bg-stone-50">
        <p className="text-[13px] text-stone-800"><span className="font-bold">You&apos;ve been placed in Room 204.</span> <span className="text-stone-500">Just now</span></p>
      </div>
      <div className="p-5 space-y-3">
        <ChatBubble mine={false} name="Priya" text="Hi! I'm an early riser, hope that's okay." />
        <ChatBubble mine name="You" text="No worries at all, same here!" />
      </div>
    </div>
  );
}

function ChatBubble({ mine, name, text }: { mine: boolean; name: string; text: string }) {
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <span className="text-[11px] text-stone-500 mb-1">{name}</span>
      <div className={`max-w-[80%] px-3.5 py-2 rounded-xl text-sm ${mine ? "bg-teal-800 text-white" : "bg-white text-stone-800 border border-stone-200"}`}>
        {text}
      </div>
    </div>
  );
}

/** Multi-tenant isolation — two sealed institution rows, visualizing
 *  organizationId scoping (docs/decisions.md #4). */
export function TenantIsolationVisual() {
  const orgs = [
    { name: "Greenfield University", detail: "412 students · own domain · own data" },
    { name: "Lakeside College", detail: "268 students · own domain · own data" },
  ];
  return (
    <div className="card-premium rounded-[20px] overflow-hidden shadow-soft">
      <ul className="divide-y divide-stone-100">
        {orgs.map((org) => (
          <li key={org.name} className="px-5 py-4 flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-teal-700 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-[14px] font-bold text-stone-900">{org.name}</p>
              <p className="text-[12px] text-stone-500">{org.detail}</p>
            </div>
            <span className="ml-auto text-[11px] font-semibold text-stone-500 border border-stone-200 rounded-md px-2 py-1 shrink-0">Isolated</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Admin overview example — a plain table, because admins need scannable
 *  tables, not illustrations. */
export function AdminPreview() {
  const rows = [
    { room: "A-204", members: 4, score: "94%", status: "Locked" },
    { room: "A-205", members: 3, score: "88%", status: "Active" },
    { room: "B-110", members: 4, score: "91%", status: "Active" },
  ];
  return (
    <div className="card-premium rounded-[20px] overflow-hidden shadow-soft">
      <div className="px-5 py-3.5 border-b border-stone-200 flex items-center justify-between">
        <p className="text-[13px] font-bold text-stone-900">Allocation overview</p>
        <span className="text-[11px] font-semibold text-stone-500">CSV export available</span>
      </div>
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-stone-500 border-b border-stone-200">
            <th className="px-5 py-2.5 font-semibold">Room</th>
            <th className="px-5 py-2.5 font-semibold">Members</th>
            <th className="px-5 py-2.5 font-semibold">Score</th>
            <th className="px-5 py-2.5 font-semibold text-right">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map((r) => (
            <tr key={r.room}>
              <td className="px-5 py-2.5 font-bold text-stone-900">{r.room}</td>
              <td className="px-5 py-2.5 text-stone-600">{r.members}</td>
              <td className="px-5 py-2.5 font-semibold text-teal-900">{r.score}</td>
              <td className="px-5 py-2.5 text-right">
                <span className={`text-[11px] font-semibold rounded-md px-2 py-1 ${r.status === "Locked" ? "bg-stone-100 text-stone-600" : "bg-teal-50 text-teal-900"}`}>{r.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
