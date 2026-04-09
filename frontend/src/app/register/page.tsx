"use client";

import { signIn, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ShieldCheck, UserCog, Building2, Mail } from "lucide-react";
import { motion } from "framer-motion";

export default function RegisterPage() {
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  // If already logged in, redirect to admin
  useEffect(() => {
    if (status === "authenticated") {
      router.push("/admin");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
      </div>
    );
  }

  const handleAdminRegister = async () => {
    if (!agreed) return;
    setLoading(true);
    // Set role cookie to ADMIN before Google OAuth
    document.cookie = `selectedRole=ADMIN; path=/; max-age=3600`;
    // Google OAuth will handle signup + signin in one step
    await signIn("google", { callbackUrl: "/admin" });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center relative overflow-hidden">
      {/* Background */}
      <div className="absolute top-0 right-0 w-full h-[60vh] bg-gradient-to-b from-violet-100/40 to-transparent pointer-events-none" />

      {/* Back link */}
      <button
        onClick={() => router.push("/")}
        className="absolute top-6 left-6 z-20 flex items-center gap-2 text-sm text-slate-400 hover:text-slate-700 transition-colors"
      >
        ← Back to home
      </button>

      <div className="z-10 relative flex flex-col items-center px-4 w-full max-w-lg">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full"
        >
          {/* Brand */}
          <div className="text-center mb-6">
            <span className="font-serif text-2xl font-semibold text-slate-700 tracking-tight">
              Room<span className="text-orange-500">IQ</span>
            </span>
            <p className="text-xs text-slate-400 mt-1">Hostel Management Platform</p>
          </div>

          {/* Card */}
          <div className="bg-white px-10 py-12 rounded-[2rem] shadow-[0_10px_50px_rgba(0,0,0,0.05)] border border-slate-100">

            {/* Icon */}
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 }}
              className="mx-auto bg-violet-100 text-violet-600 p-4 rounded-full w-20 h-20 flex items-center justify-center mb-6"
            >
              <UserCog className="w-10 h-10" />
            </motion.div>

            <h1 className="text-2xl font-bold text-slate-800 mb-2 text-center">
              Admin Registration
            </h1>
            <p className="text-slate-500 text-sm text-center leading-relaxed mb-8 px-2">
              Register as a hostel administrator using your official SIT Google account. Once verified, you'll have full access to the management dashboard.
            </p>

            {/* What you get */}
            <div className="space-y-3 mb-8">
              {[
                { icon: Building2, text: "Configure your hostel — blocks, rooms, amenities" },
                { icon: UserCog, text: "Run AI-powered room allocation for your students" },
                { icon: Mail, text: "Manage student profiles and allocation reports" },
              ].map(({ icon: Icon, text }) => (
                <div
                  key={text}
                  className="flex items-center gap-3 bg-violet-50 rounded-xl px-4 py-3"
                >
                  <Icon className="w-4 h-4 text-violet-500 flex-shrink-0" />
                  <span className="text-sm text-slate-600">{text}</span>
                </div>
              ))}
            </div>

            {/* Agreement checkbox */}
            <label className="flex items-start gap-3 mb-8 cursor-pointer group">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                    agreed
                      ? "bg-violet-600 border-violet-600"
                      : "border-slate-300 group-hover:border-violet-400"
                  }`}
                >
                  {agreed && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-xs text-slate-500 leading-relaxed">
                I confirm I am a hostel warden or faculty administrator at SIT Pune. I understand this platform is for institutional use only and agree to use it responsibly.
              </span>
            </label>

            {/* Google Sign In Button */}
            <button
              onClick={handleAdminRegister}
              disabled={loading || !agreed}
              className="w-full text-white font-medium py-4 px-6 rounded-xl flex items-center justify-center gap-4 transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed bg-violet-600 hover:bg-violet-700"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <div className="bg-white p-1 rounded-md">
                    <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.86C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.05H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.95l3.66-2.86z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.86c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                  </div>
                  Register with SIT Account
                  <ChevronRight className="w-5 h-5 ml-1 opacity-70" />
                </>
              )}
            </button>

            {/* Footer */}
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Restricted to @sitpune.edu.in accounts</span>
            </div>

            <div className="mt-4 text-center">
              <span className="text-xs text-slate-400">Already registered? </span>
              <button
                onClick={() => router.push("/login")}
                className="text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors"
              >
                Log in here →
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}