"use client";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  MessageCircle, ShieldCheck, Sparkles, Bell, Users, LayoutGrid,
  SlidersHorizontal, FileDown, Lock, ClipboardList, ArrowRight,
  CheckCircle2, Building2, History,
} from "lucide-react";
import HeroVisual from "@/components/landing/HeroVisual";
import Mascot from "@/components/landing/Mascot";
import {
  CompatibilityRing, ConstraintDiagram, NotificationChatMock,
  TenantIsolationVisual, AdminPreview,
} from "@/components/landing/FeatureVisuals";

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  // useReducedMotion() is null on the server and resolves client-side after
  // mount - toggling *which* props are passed based on it (rather than just
  // their values) makes the server-rendered markup and the client's first
  // render disagree, which React flags as a real hydration mismatch. Instead,
  // keep initial/whileInView always present (identical shape every time) and
  // only collapse the transition duration to 0 when reduced motion is on -
  // same practical effect (no visible motion), no mismatch.
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: reduced ? 0 : 0.6, delay: reduced ? 0 : delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

const REAL_CAPABILITIES = [
  "Cosine-similarity compatibility matching", "Two-phase allocation engine",
  "Hard-constraint pre-filters", "Real-time Socket.IO notifications",
  "Multi-tenant by design", "Self-serve org onboarding",
];

const STUDENT_BENEFITS = [
  {
    icon: Sparkles,
    title: "Matched from a real questionnaire",
    desc: "A ~30-question lifestyle questionnaire — sleep schedule, cleanliness, study habits, personality — feeds a real compatibility-matching engine, not a coin flip.",
  },
  {
    icon: CheckCircle2,
    title: "Guaranteed placement — never silent",
    desc: "A two-phase pipeline places 100% of students it possibly can. The rare student it truly can't place is flagged for manual review with the specific reason — never silently dropped.",
  },
  {
    icon: MessageCircle,
    title: "Notified live, connected instantly",
    desc: "The moment you're placed, a real-time notification finds you — and a private chat with your actual roommates opens up immediately, before move-in day.",
  },
];

const ADMIN_BENEFITS = [
  {
    icon: Building2,
    title: "Self-serve institution onboarding",
    desc: "Register your own institution with your own verified email domain. Your dashboard is isolated from every other institution's data from the moment it's created.",
  },
  {
    icon: History,
    title: "Every admin action, audit-logged",
    desc: "Locks, manual swaps, CSV syncs — every admin action is written to a real audit log, scoped to your organization, queryable after the fact.",
  },
  {
    icon: FileDown,
    title: "CSV and analytics export",
    desc: "Sync your existing roster in from CSV or Google Sheets, and export allocation results and analytics back out whenever you need them.",
  },
];

const STORY_MILESTONES = [
  {
    tag: "The start",
    title: "A BTech capstone, for one institution",
    desc: "RoomFit started as a single-institution final-year project: one hostel, one dataset, one hardcoded set of assumptions baked into the code.",
    accent: "teal" as const,
  },
  {
    tag: "The rebuild",
    title: "Rebuilt into a real multi-tenant SaaS",
    desc: "Every collection gained real organization scoping, self-serve institution onboarding replaced hardcoded assumptions, and domain-verified signup keeps each institution's data genuinely isolated from every other.",
    accent: "teal" as const,
  },
  {
    tag: "The audit",
    title: "We found real security bugs — and closed them",
    desc: "A client-trusted role field meant any account could silently self-promote to admin on login; a service call between our own backends had no auth on it at all. Both were found during our own review and closed, not left as someone else's problem.",
    accent: "violet" as const,
  },
  {
    tag: "The proof",
    title: "Load-tested under real, sustained pressure",
    desc: "A real k6 load test — not a manifest nobody ran — pushed the allocation engine hard enough to scale from 1 to 5 replicas under sustained CPU pressure, hold there, and scale back down correctly once load eased.",
    accent: "teal" as const,
  },
];

export default function Landing() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 overflow-x-hidden">
      {/* NAV */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-stone-50/80 border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-lg text-stone-900">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600" />
            RoomFit
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-stone-600">
            <a href="#how-it-works" className="hover:text-stone-900 transition-colors">How it works</a>
            <a href="#students" className="hover:text-stone-900 transition-colors">Students</a>
            <a href="#admins" className="hover:text-stone-900 transition-colors">Admins</a>
            <a href="#our-story" className="hover:text-stone-900 transition-colors">Our story</a>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={() => router.push("/login")} className="text-sm text-stone-600 hover:text-stone-900 px-2 sm:px-3 py-2 transition-colors whitespace-nowrap">
              Log in
            </button>
            <button
              onClick={() => router.push("/register")}
              className="text-sm font-medium bg-teal-700 hover:bg-teal-800 text-white px-3.5 sm:px-4 py-2 rounded-full transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <span className="hidden sm:inline">Register your institution</span>
              <span className="sm:hidden">Register</span> <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
            </button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative max-w-7xl mx-auto px-6 pt-10 pb-12 sm:pt-16 sm:pb-20 grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-full px-3 py-1.5 mb-6">
            <Sparkles className="w-3.5 h-3.5" /> Multi-tenant hostel allocation
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] mb-6 text-stone-900">
            Roommates matched by
            <span className="block bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">compatibility, not chance.</span>
          </h1>
          <p className="text-stone-600 text-lg leading-relaxed max-w-lg mb-8">
            RoomFit turns a lifestyle questionnaire into roommate groupings that actually
            get along — while never crossing the constraints your institution can&apos;t
            compromise on.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => router.push("/register")}
              className="bg-teal-700 hover:bg-teal-800 text-white font-medium px-6 py-3.5 rounded-full transition-colors flex items-center gap-2 shadow-lg shadow-teal-900/15"
            >
              Register your institution <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => router.push("/login")}
              className="text-stone-700 hover:text-stone-900 font-medium px-6 py-3.5 rounded-full border border-stone-300 hover:border-stone-400 transition-colors"
            >
              Log in
            </button>
          </div>
        </div>
        <HeroVisual />
      </section>

      {/* REAL CAPABILITIES STRIP - descriptive, not invented stats */}
      <div className="border-y border-stone-200 bg-white py-5 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {REAL_CAPABILITIES.map((c) => (
            <span key={c} className="text-xs font-medium text-stone-600 flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-teal-600" /> {c}
            </span>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-6 py-14 sm:py-20 lg:py-24">
        <Reveal>
          <p className="text-xs font-semibold tracking-widest uppercase text-teal-700 mb-3">Process</p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 max-w-xl text-stone-900">From questionnaire to move-in day.</h2>
          <p className="text-stone-600 max-w-lg mb-12">A two-phase pipeline that optimizes for compatibility first, then guarantees everyone gets a room.</p>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: ClipboardList, title: "A real lifestyle questionnaire", desc: "~30 questions on sleep schedule, cleanliness, study habits, and personality — takes a few minutes, saved as you go." },
            { icon: Sparkles, title: "Compatibility, then constraints", desc: "The engine optimizes for compatibility first, then guarantees placement — hard constraints like gender and smoking compatibility are never traded off for a better score." },
            { icon: Bell, title: "Matched and notified instantly", desc: "The moment a room is assigned, students get a live notification and can see exactly why they were matched." },
          ].map((s, i) => (
            <Reveal key={s.title} delay={i * 0.1}>
              <div className="glass-card rounded-2xl p-7 h-full">
                <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center mb-5">
                  <s.icon className="w-5 h-5 text-teal-700" />
                </div>
                <h3 className="font-semibold text-stone-800 mb-2">{s.title}</h3>
                <p className="text-sm text-stone-600 leading-relaxed">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FOR STUDENTS */}
      <section id="students" className="bg-white border-y border-stone-200">
        <div className="max-w-7xl mx-auto px-6 py-14 sm:py-20 lg:py-24">
          <Reveal>
            <p className="text-xs font-semibold tracking-widest uppercase text-teal-700 mb-3">For students</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 max-w-xl text-stone-900">Students will be...</h2>
            <p className="text-stone-600 max-w-lg mb-12">Real benefits, grounded in the actual allocation engine and notification system — not aspirational copy.</p>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            {STUDENT_BENEFITS.map((b, i) => (
              <Reveal key={b.title} delay={i * 0.1}>
                <div className="glass-card rounded-2xl p-7 h-full">
                  <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center mb-5">
                    <b.icon className="w-5 h-5 text-teal-700" />
                  </div>
                  <h3 className="font-semibold text-stone-800 mb-2">{b.title}</h3>
                  <p className="text-sm text-stone-600 leading-relaxed">{b.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* HARD CONSTRAINTS */}
      <section className="max-w-7xl mx-auto px-6 py-14 sm:py-20 lg:py-24 grid lg:grid-cols-2 gap-14 items-center">
        <Reveal>
          <p className="text-xs font-semibold tracking-widest uppercase text-teal-700 mb-3">Never compromised</p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-5 text-stone-900">Hard constraints are absolute — not a scored feature.</h2>
          <p className="text-stone-600 leading-relaxed mb-6">
            No mixed-gender rooms. No smoking/non-smoking pairings. These aren&apos;t
            preferences the algorithm weighs against everything else — they exclude a
            pairing outright, before any matching runs at all.
          </p>
          <ul className="space-y-3">
            {["Gender and smoking/drinking incompatibility checked as absolute pre-filters", "A two-phase optimize-then-guarantee design places every student it possibly can", "The rare unplaceable case is flagged explicitly with the specific blocking reason — never hidden or forced"].map((t) => (
              <li key={t} className="flex items-start gap-3 text-sm text-stone-700">
                <ShieldCheck className="w-4 h-4 text-teal-700 mt-0.5 flex-shrink-0" /> {t}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.15}>
          <ConstraintDiagram />
        </Reveal>
      </section>

      {/* EXPLAINABILITY */}
      <section className="bg-white border-y border-stone-200">
        <div className="max-w-7xl mx-auto px-6 py-14 sm:py-20 lg:py-24 grid lg:grid-cols-2 gap-14 items-center">
          <Reveal>
            <div className="glass-card rounded-2xl p-8 flex flex-col items-center">
              <CompatibilityRing score={92} />
              <p className="text-sm text-stone-600 mt-4 text-center">&ldquo;Why We Matched&rdquo; — shared quiet-study hours, similar sleep schedule, aligned cleanliness expectations.</p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-xs font-semibold tracking-widest uppercase text-teal-700 mb-3">Why we match</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-5 text-stone-900">No black box. See exactly why.</h2>
            <p className="text-stone-600 leading-relaxed mb-6">
              Every match comes with a real explanation — what you have in common, and the
              specific things worth discussing with your new roommates before move-in.
            </p>
            <ul className="space-y-3">
              {["“Why We Matched” breaks down the real shared traits behind your score", "“Things to discuss” surfaces predicted friction points honestly, upfront", "Room-size and ground-floor accessibility preferences honored best-effort — never a placement blocker"].map((t) => (
                <li key={t} className="flex items-start gap-3 text-sm text-stone-700">
                  <SlidersHorizontal className="w-4 h-4 text-teal-700 mt-0.5 flex-shrink-0" /> {t}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* CHAT + NOTIFICATIONS */}
      <section className="max-w-7xl mx-auto px-6 py-14 sm:py-20 lg:py-24 grid lg:grid-cols-2 gap-14 items-center">
        <Reveal>
          <p className="text-xs font-semibold tracking-widest uppercase text-teal-700 mb-3">Stay connected</p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-5 text-stone-900">Meet your roommates before you move in.</h2>
          <p className="text-stone-600 leading-relaxed mb-6">
            The moment you&apos;re placed, you know it — live if you&apos;re online, waiting
            for you if you weren&apos;t. A private chat with just your room group opens up
            immediately.
          </p>
          <div className="flex items-center gap-3 text-sm text-stone-700">
            <MessageCircle className="w-4 h-4 text-teal-700" /> Private, room-scoped roommate chat
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <NotificationChatMock />
        </Reveal>
      </section>

      {/* MULTI-TENANT */}
      <section className="bg-white border-y border-stone-200">
        <div className="max-w-7xl mx-auto px-6 py-14 sm:py-20 lg:py-24">
          <Reveal>
            <p className="text-xs font-semibold tracking-widest uppercase text-teal-700 mb-3">Built for institutions</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 max-w-xl text-stone-900">One platform, completely isolated per institution.</h2>
            <p className="text-stone-600 max-w-lg mb-10">Register your own organization with your own email domain — your data is never visible to any other institution, ever.</p>
          </Reveal>
          <Reveal delay={0.1}>
            <TenantIsolationVisual />
          </Reveal>
        </div>
      </section>

      {/* FOR ADMINS */}
      <section id="admins" className="max-w-7xl mx-auto px-6 py-14 sm:py-20 lg:py-24">
        <Reveal>
          <p className="text-xs font-semibold tracking-widest uppercase text-teal-700 mb-3">For admins</p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 max-w-xl text-stone-900">Admins will be...</h2>
          <p className="text-stone-600 max-w-lg mb-12">Real operational benefits, grounded in what the platform actually enforces and logs.</p>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-6">
          {ADMIN_BENEFITS.map((b, i) => (
            <Reveal key={b.title} delay={i * 0.1}>
              <div className="glass-card rounded-2xl p-7 h-full">
                <div className="w-11 h-11 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center mb-5">
                  <b.icon className="w-5 h-5 text-orange-700" />
                </div>
                <h3 className="font-semibold text-stone-800 mb-2">{b.title}</h3>
                <p className="text-sm text-stone-600 leading-relaxed">{b.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ADMIN TOOLKIT (detailed) */}
      <section className="bg-white border-y border-stone-200">
        <div className="max-w-7xl mx-auto px-6 py-14 sm:py-20 lg:py-24 grid lg:grid-cols-2 gap-14 items-center">
          <Reveal>
            <p className="text-xs font-semibold tracking-widest uppercase text-teal-700 mb-3">Admin toolkit</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-5 text-stone-900">Dense, fast, and fully in your control.</h2>
            <p className="text-stone-600 leading-relaxed mb-6">
              Sync your existing roster from CSV or Google Sheets, run allocation, then
              review, lock, or manually swap any assignment — every action logged.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: LayoutGrid, t: "Analytics dashboard" }, { icon: FileDown, t: "PDF / CSV export" },
                { icon: Lock, t: "Room lock & manual swap" }, { icon: Users, t: "Accommodation requests" },
              ].map((f) => (
                <div key={f.t} className="flex items-center gap-2.5 text-sm text-stone-700">
                  <f.icon className="w-4 h-4 text-teal-700 flex-shrink-0" /> {f.t}
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <AdminPreview />
          </Reveal>
        </div>
      </section>

      {/* OUR STORY */}
      <section id="our-story" className="max-w-5xl mx-auto px-6 py-14 sm:py-20 lg:py-24">
        <Reveal>
          <p className="text-xs font-semibold tracking-widest uppercase text-teal-700 mb-3">Our story</p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 max-w-xl text-stone-900">From a class project to a platform we stress-tested for real.</h2>
          <p className="text-stone-600 max-w-2xl mb-12 leading-relaxed">
            No press mentions, no client logos, no testimonials yet — this project is
            young. What it does have is an honest build history, including the parts
            that weren&apos;t clean the first time.
          </p>
        </Reveal>
        <div className="relative pl-8">
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-stone-200" aria-hidden="true" />
          <div className="space-y-10">
            {STORY_MILESTONES.map((m, i) => (
              <Reveal key={m.title} delay={i * 0.08}>
                <div className="relative">
                  <span
                    className={`absolute -left-8 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white ${m.accent === "violet" ? "bg-violet-500" : "bg-teal-600"}`}
                    aria-hidden="true"
                  />
                  <p className={`text-xs font-semibold tracking-widest uppercase mb-1.5 ${m.accent === "violet" ? "text-violet-700" : "text-teal-700"}`}>{m.tag}</p>
                  <h3 className="font-semibold text-stone-900 mb-1.5">{m.title}</h3>
                  <p className="text-sm text-stone-600 leading-relaxed max-w-2xl">{m.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 py-14 sm:py-20 lg:py-24 text-center relative">
        <Reveal>
          <Mascot className="w-24 h-24 mx-auto mb-6" />
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-stone-900">Ready to give your students a better start?</h2>
          <p className="text-stone-600 max-w-md mx-auto mb-8">Register your institution and get a fully isolated dashboard in minutes.</p>
          <button
            onClick={() => router.push("/register")}
            className="bg-teal-700 hover:bg-teal-800 text-white font-medium px-7 py-3.5 rounded-full transition-colors inline-flex items-center gap-2 shadow-lg shadow-teal-900/15"
          >
            Register your institution <ArrowRight className="w-4 h-4" />
          </button>
        </Reveal>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-stone-200">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-stone-600">
            <Mascot className="w-8 h-8" /> RoomFit
          </div>
          <p className="text-xs text-stone-600">Multi-tenant hostel roommate allocation.</p>
        </div>
      </footer>
    </div>
  );
}
