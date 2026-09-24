"use client";
import { useRouter } from "next/navigation";
import {
  MessageCircle, Sparkles, Bell, Users, LayoutGrid,
  SlidersHorizontal, FileDown, Lock, ClipboardList, ArrowRight,
  CheckCircle2, Building2, History,
} from "lucide-react";
import Navbar, { Reveal } from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import HeroVisual from "@/components/landing/HeroVisual";
import { EyebrowBadge } from "@/components/premium";
import {
  CompatibilityRing, ConstraintDiagram, NotificationChatMock,
  TenantIsolationVisual, AdminPreview, MatchFlow,
} from "@/components/landing/FeatureVisuals";

const REAL_CAPABILITIES = [
  "Compatibility matching",
  "Two-phase allocation",
  "Hard-constraint checks",
  "Live notifications",
  "Multi-tenant by design",
  "Self-serve onboarding",
];

const STUDENT_BENEFITS = [
  {
    icon: Sparkles,
    title: "Matched from a real questionnaire",
    desc: "A ~30-question lifestyle questionnaire — sleep schedule, cleanliness, study habits, personality — feeds a real compatibility-matching engine, not a coin flip.",
  },
  {
    icon: CheckCircle2,
    title: "Placed with a reason, or flagged honestly",
    desc: "A two-phase pipeline places everyone it possibly can. The rare student it truly can't place is flagged for manual review with the specific reason — never silently dropped.",
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
  },
  {
    tag: "The rebuild",
    title: "Rebuilt into multi-tenant software",
    desc: "Every collection gained organization scoping, self-serve institution onboarding replaced hardcoded assumptions, and domain-verified signup keeps each institution's data isolated.",
  },
  {
    tag: "The audit",
    title: "We found real security bugs — and closed them",
    desc: "A client-trusted role field meant any account could silently self-promote to admin on login; a service call between our own backends had no auth on it at all. Both were found during our own review and closed.",
  },
  {
    tag: "The proof",
    title: "Load-tested under sustained pressure",
    desc: "A k6 load test pushed the allocation engine hard enough to scale from 1 to 5 replicas under sustained CPU pressure, hold there, and scale back down once load eased.",
  },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow text-teal-800 mb-3">{children}</p>;
}

function SectionHead({ eyebrow, title, lede }: { eyebrow: string; title: string; lede?: string }) {
  return (
    <div className="max-w-2xl mb-12">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-stone-900 leading-[1.12]">{title}</h2>
      {lede && <p className="text-stone-600 mt-4 leading-relaxed text-[16px]">{lede}</p>}
    </div>
  );
}

export default function Landing() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#faf9f7] text-stone-800 overflow-x-hidden">
      <Navbar />

      {/* HERO */}
      <section className="hero-wash border-b border-stone-200/80 overflow-hidden">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 pt-14 pb-16 sm:pt-20 sm:pb-24 grid lg:grid-cols-[1.05fr_0.95fr] gap-12 items-center">
          <div>
            <EyebrowBadge>Hostel roommate allocation · for institutions</EyebrowBadge>
            <h1 className="text-[42px] sm:text-6xl font-bold tracking-tight leading-[1.04] text-stone-950 mt-6 mb-6">
              Find the people<br />
              you&apos;ll actually<br />
              <span className="text-teal-800">love living with.</span>
            </h1>
            <p className="text-stone-600 text-[17px] leading-relaxed max-w-md mb-9">
              RoomFit turns a short lifestyle questionnaire into roommate
              groupings that get along — while enforcing the constraints your
              institution can&apos;t compromise on.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => router.push("/register")}
                className="btn-primary font-semibold px-7 py-3.5 rounded-2xl flex items-center justify-center gap-2 text-[15px]"
              >
                Register your institution <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => router.push("/login")}
                className="btn-quiet font-semibold px-7 py-3.5 rounded-2xl border border-stone-300 hover:border-stone-400 hover:-translate-y-px text-stone-800 bg-white text-[15px] transition-all"
              >
                Log in
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-8">
              {["Free to set up", "Isolated per institution", "Live in minutes"].map((t) => (
                <span key={t} className="chip chip-stone">{t}</span>
              ))}
            </div>
          </div>

          <Reveal delay={0.1} className="min-w-0">
            <HeroVisual />
            <p className="text-[12px] text-stone-500 mt-4 text-center">Live 3D preview of a RoomFit match — the room, the roommates, and the compatibility behind them.</p>
          </Reveal>
        </div>
      </section>

      {/* CAPABILITIES */}
      <div className="border-b border-stone-200/80 bg-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-4 flex flex-wrap gap-x-7 gap-y-2">
          {REAL_CAPABILITIES.map((c) => (
            <span key={c} className="text-[13px] font-medium text-stone-600">{c}</span>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-5 sm:px-6 py-16 sm:py-24 scroll-mt-16">
        <Reveal>
          <SectionHead
            eyebrow="How it works"
            title="From questionnaire to move-in day"
            lede="A two-phase pipeline that optimizes for compatibility first, then guarantees everyone gets a room."
          />
        </Reveal>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: ClipboardList, step: "Step 1", title: "Students answer a lifestyle questionnaire", desc: "~30 questions on sleep, cleanliness, study habits, and personality. Takes a few minutes, saved as you go." },
            { icon: Sparkles, step: "Step 2", title: "The engine matches, constraints gate", desc: "Compatibility is optimized first; gender and smoking compatibility are absolute pre-filters, never traded off for a better score." },
            { icon: Bell, step: "Step 3", title: "Rooms assigned, students notified", desc: "The moment a room is assigned, students get a live notification and can see exactly why they were matched." },
          ].map((s, i) => (
            <Reveal key={s.title} delay={i * 0.06}>
              <div className="card-premium rounded-[20px] p-7 h-full lift">
                <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-4">{s.step}</p>
                <div className="w-11 h-11 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center mb-5">
                  <s.icon className="w-5 h-5 text-teal-800" />
                </div>
                <h3 className="font-bold text-stone-900 text-[15px] mb-1.5">{s.title}</h3>
                <p className="text-sm text-stone-600 leading-relaxed">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* COMPATIBILITY */}
      <section className="bg-white border-y border-stone-200/80">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-16 sm:py-24 grid lg:grid-cols-2 gap-10 items-start">
          <Reveal>
            <Eyebrow>Compatibility engine</Eyebrow>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-stone-900 leading-[1.12] mb-4">
              RoomFit understands people, not just rooms.
            </h2>
            <p className="text-stone-600 leading-relaxed mb-6 text-[15px]">
              Two profiles go in. Shared lifestyle signals are weighed, hard
              constraints gate the pairing, and a compatibility score comes out —
              attached to an actual room.
            </p>
            <ul className="space-y-2.5 text-[14px] text-stone-700">
              {[
                "Sleep, cleanliness, study, social, food and noise preferences",
                "Every score links back to the shared traits behind it",
                "Hard gates run first — never scored away",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-800 mt-0.5 shrink-0" /> {t}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.06}>
            <MatchFlow />
          </Reveal>
        </div>
      </section>

      {/* CONSTRAINTS */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-16 sm:py-24 grid lg:grid-cols-2 gap-10 items-start">
        <Reveal>
          <Eyebrow>Non-negotiables</Eyebrow>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-stone-900 leading-[1.12] mb-4">
            Hard constraints are absolute.
          </h2>
          <p className="text-stone-600 leading-relaxed text-[15px]">
            No mixed-gender rooms. No smoking/non-smoking pairings. These
            aren&apos;t preferences the algorithm weighs — they exclude a pairing
            outright, before matching runs. The rare student who can&apos;t be
            placed is flagged with the specific reason, never hidden or forced.
          </p>
        </Reveal>
        <Reveal delay={0.06}>
          <ConstraintDiagram />
        </Reveal>
      </section>

      {/* EXPLAINABILITY */}
      <section className="bg-white border-y border-stone-200/80">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-16 sm:py-24 grid lg:grid-cols-[0.9fr_1.1fr] gap-10 items-center">
            <Reveal>
              <div className="card-premium rounded-[24px] p-8 flex flex-col items-center shadow-soft">
              <CompatibilityRing score={92} />
              <p className="text-sm text-stone-600 mt-4 text-center leading-relaxed max-w-xs">
                &ldquo;Why We Matched&rdquo; — shared quiet-study hours, similar
                sleep schedule, aligned cleanliness expectations.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.06}>
            <Eyebrow>Why we match</Eyebrow>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-stone-900 leading-[1.12] mb-4">
              No black box. See exactly why.
            </h2>
            <ul className="space-y-2.5 text-[14px] text-stone-700">
              {[
                "“Why We Matched” lists the shared traits behind each score",
                "“Things to discuss” surfaces likely friction points upfront",
                "Room-size and accessibility preferences honored best-effort",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <SlidersHorizontal className="w-4 h-4 text-teal-800 mt-0.5 shrink-0" /> {t}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* CHAT */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-16 sm:py-24 grid lg:grid-cols-2 gap-10 items-start">
        <Reveal>
          <Eyebrow>Stay connected</Eyebrow>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-stone-900 leading-[1.12] mb-4">
            Meet your roommates before move-in.
          </h2>
          <p className="text-stone-600 leading-relaxed mb-5 text-[15px]">
            The moment you&apos;re placed, you know it — live if you&apos;re
            online, waiting for you if you weren&apos;t. A private chat with
            just your room group opens immediately.
          </p>
          <p className="flex items-center gap-2 text-sm text-stone-700">
            <MessageCircle className="w-4 h-4 text-teal-800" /> Private, room-scoped chat
          </p>
        </Reveal>
        <Reveal delay={0.06}>
          <NotificationChatMock />
        </Reveal>
      </section>

      {/* INSTITUTIONS */}
      <section className="bg-white border-y border-stone-200/80">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-16 sm:py-24 grid lg:grid-cols-2 gap-10 items-start">
          <Reveal>
            <Eyebrow>Built for institutions</Eyebrow>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-stone-900 leading-[1.12] mb-4">
              One platform, isolated per institution.
            </h2>
            <p className="text-stone-600 leading-relaxed text-[15px]">
              Register your organization with your own email domain. Your
              students, rooms, and allocations are never visible to any other
              institution.
            </p>
          </Reveal>
          <Reveal delay={0.06}>
            <TenantIsolationVisual />
          </Reveal>
        </div>
      </section>

      {/* FOR STUDENTS */}
      <section id="students" className="max-w-6xl mx-auto px-5 sm:px-6 py-16 sm:py-24 scroll-mt-16">
        <Reveal>
          <SectionHead eyebrow="For students" title="Designed around student life" />
        </Reveal>
        <div className="grid md:grid-cols-3 gap-4">
          {STUDENT_BENEFITS.map((b, i) => (
            <Reveal key={b.title} delay={i * 0.06}>
              <div className="card-premium rounded-[20px] p-7 h-full lift">
                <div className="w-11 h-11 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center mb-5">
                  <b.icon className="w-5 h-5 text-teal-800" />
                </div>
                <h3 className="font-bold text-stone-900 text-[15px] mb-1.5">{b.title}</h3>
                <p className="text-sm text-stone-600 leading-relaxed">{b.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FOR ADMINS */}
      <section id="admins" className="bg-white border-y border-stone-200/80 scroll-mt-16">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-16 sm:py-24">
          <Reveal>
            <SectionHead
              eyebrow="For admins"
              title="Operational control, without the spreadsheet chaos"
              lede="Sync your roster, run allocation, review, lock, or swap any assignment — every action logged."
            />
          </Reveal>
          <div className="grid md:grid-cols-3 gap-4 mb-10">
            {ADMIN_BENEFITS.map((b, i) => (
              <Reveal key={b.title} delay={i * 0.06}>
                <div className="card-premium rounded-[20px] p-7 h-full lift">
                  <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mb-5">
                    <b.icon className="w-5 h-5 text-amber-800" />
                  </div>
                  <h3 className="font-bold text-stone-900 text-[15px] mb-1.5">{b.title}</h3>
                  <p className="text-sm text-stone-600 leading-relaxed">{b.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="grid lg:grid-cols-2 gap-10 items-start">
            <Reveal>
              <h3 className="font-bold text-stone-900 text-[16px] mb-4">What the console covers</h3>
              <ul className="grid sm:grid-cols-2 gap-2.5">
                {[
                  { icon: LayoutGrid, t: "Analytics dashboard" }, { icon: FileDown, t: "PDF / CSV export" },
                  { icon: Lock, t: "Room lock & manual swap" }, { icon: Users, t: "Accommodation requests" },
                ].map((f) => (
                  <li key={f.t} className="flex items-center gap-2.5 text-sm text-stone-700 border border-stone-200 rounded-2xl px-4 py-3.5 bg-[#faf9f7] hover:border-teal-800/40 hover:bg-white transition-colors">
                    <f.icon className="w-4 h-4 text-teal-800 shrink-0" /> {f.t}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.06}>
              <AdminPreview />
            </Reveal>
          </div>
        </div>
      </section>

      {/* OUR STORY */}
      <section id="our-story" className="max-w-3xl mx-auto px-5 sm:px-6 py-16 sm:py-24 scroll-mt-16">
        <Reveal>
          <SectionHead
            eyebrow="Our story"
            title="From a class project to tested software"
            lede="No press mentions or client logos yet — this project is young. What it has is an honest build history."
          />
        </Reveal>
        <div className="relative pl-7">
          <div className="absolute left-[6px] top-2 bottom-2 w-px bg-stone-200" aria-hidden="true" />
          <div className="space-y-8">
            {STORY_MILESTONES.map((m, i) => (
              <Reveal key={m.title} delay={i * 0.04}>
                <div className="relative">
                  <span className="absolute -left-7 top-1.5 w-3 h-3 rounded-full bg-teal-700 border-2 border-white shadow-sm" aria-hidden="true" />
                  <p className="eyebrow text-stone-500 mb-1">{m.tag}</p>
                  <h3 className="font-bold text-stone-900 text-[15px] mb-1">{m.title}</h3>
                  <p className="text-sm text-stone-600 leading-relaxed">{m.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 pb-16 sm:pb-24">
        <Reveal>
          <div className="teal-band rounded-[28px] px-6 py-12 sm:px-12 sm:py-14 grid lg:grid-cols-[1.2fr_auto] gap-8 items-center shadow-lift relative overflow-hidden">
            <div aria-hidden="true" className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-teal-300/20 blur-3xl" />
            <div aria-hidden="true" className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-amber-300/20 blur-3xl" />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-[1.12]">Give your students a better start to the year.</h2>
              <p className="text-teal-50/90 mt-3 text-[16px]">Register your institution and get an isolated dashboard in minutes.</p>
            </div>
            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 relative">
              <button
                onClick={() => router.push("/register")}
                className="font-semibold px-7 py-3.5 rounded-2xl inline-flex items-center justify-center gap-2 whitespace-nowrap bg-white text-teal-900 hover:-translate-y-px hover:shadow-lift transition-all"
              >
                Register your institution <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => router.push("/login")}
                className="font-semibold px-7 py-3.5 rounded-2xl border border-white/40 text-white hover:bg-white/10 whitespace-nowrap transition-colors"
              >
                Log in
              </button>
            </div>
          </div>
        </Reveal>
      </section>

      <Footer />
    </div>
  );
}
