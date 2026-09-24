"use client";
import { useRouter } from "next/navigation";
import RoomFitLogo from "./RoomFitLogo";

export default function Footer() {
  const router = useRouter();
  return (
    <footer className="border-t border-stone-200 bg-white">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 py-12 grid gap-10 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <RoomFitLogo className="w-8 h-8" />
            <span className="font-bold text-stone-900 text-[16px]">RoomFit</span>
          </div>
          <p className="text-sm text-stone-600 leading-relaxed max-w-xs">
            Hostel roommate allocation, matched by compatibility. Built for
            institutions, designed for the students who live there.
          </p>
          <p className="mt-4">
            <span className="chip chip-teal">Compatibility, not chance</span>
          </p>
        </div>
        <div>
          <p className="eyebrow text-stone-500 mb-3">Product</p>
          <ul className="space-y-2 text-sm text-stone-600">
            <li><a href="#how-it-works" className="hover:text-stone-950 transition-colors">How it works</a></li>
            <li><a href="#students" className="hover:text-stone-950 transition-colors">For students</a></li>
            <li><a href="#admins" className="hover:text-stone-950 transition-colors">For admins</a></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow text-stone-500 mb-3">Get started</p>
          <ul className="space-y-2 text-sm text-stone-600">
            <li><a href="#our-story" className="hover:text-stone-950 transition-colors">Our story</a></li>
            <li><button onClick={() => router.push("/register")} className="hover:text-stone-950 transition-colors">Register your institution</button></li>
            <li><button onClick={() => router.push("/login")} className="hover:text-stone-950 transition-colors">Log in</button></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-stone-100">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-1">
          <p className="text-xs text-stone-500">© {new Date().getFullYear()} RoomFit</p>
          <p className="text-xs text-stone-500">Compatibility, not chance.</p>
        </div>
      </div>
    </footer>
  );
}
