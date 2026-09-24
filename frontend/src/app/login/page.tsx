"use client";

import { signIn, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ShieldCheck, User, UserCog } from "lucide-react";
import AuthShell from "@/components/AuthShell";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState("STUDENT");
  const [demoMode, setDemoMode] = useState(false);
  const [demoEmail, setDemoEmail] = useState("");
  const [demoPassword, setDemoPassword] = useState("");

  // Dev mode states
  const [step, setStep] = useState<"ROLE_SELECT" | "FORM_INPUT">("ROLE_SELECT");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const isDevAuth = process.env.NEXT_PUBLIC_DEV_AUTH === "true";

  useEffect(() => {
    if (status === "authenticated") {
      if (session?.user?.role === "admin" || session?.user?.role === "ADMIN") {
        router.push("/admin");
      } else {
        router.push("/student");
      }
    }
  }, [status, session, router]);

  const handleSignIn = async () => {
    setLoading(true);
    document.cookie = `selectedRole=${role}; path=/; max-age=3600`;
    await signIn("google", { callbackUrl: role === "ADMIN" ? "/admin" : "/student" });
  };

  const handleDemoSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    document.cookie = `selectedRole=${role}; path=/; max-age=3600`;
    await signIn("credentials", {
      email: demoEmail,
      password: demoPassword,
      callbackUrl: role === "ADMIN" ? "/admin" : "/student",
    });
  };

  const handleDevSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;
    setLoading(true);
    document.cookie = `selectedRole=${role}; path=/; max-age=3600`;
    await signIn("dev-login", {
      name,
      email,
      role: role.toUpperCase(),
      callbackUrl: role === "ADMIN" ? "/admin" : "/student",
    });
  };

  // If still checking session, show nothing to avoid flash
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-stone-300 border-t-teal-800 rounded-full animate-spin" />
      </div>
    );
  }

  const inputCls =
    "w-full bg-white border border-stone-300 rounded-lg px-3.5 py-2.5 text-sm text-stone-900 focus:outline-none focus:border-teal-800 transition-colors placeholder:text-stone-400";
  const labelCls = "text-[12px] font-semibold text-stone-700 block mb-1.5";

  // Developer simplified authentication flow UI
  if (isDevAuth) {
    return (
      <AuthShell
        title="Welcome to RoomFit"
        subtitle="Development sign-in — select your role to continue."
      >
        {step === "ROLE_SELECT" ? (
          <div className="space-y-3">
            <button
              onClick={() => {
                setRole("STUDENT");
                setStep("FORM_INPUT");
              }}
              className="w-full p-4 rounded-lg bg-white border border-stone-300 hover:border-teal-800 text-left flex items-center gap-3 transition-colors"
            >
              <span className="p-2 bg-teal-50 border border-teal-200 rounded-lg text-teal-800">
                <User className="w-5 h-5" />
              </span>
              <span>
                <span className="block text-[14px] font-bold text-stone-900">Continue as Student</span>
                <span className="block text-xs text-stone-500 mt-0.5">Dashboard, questionnaire &amp; roommate chat</span>
              </span>
              <ChevronRight className="w-4 h-4 text-stone-400 ml-auto" />
            </button>

            <button
              onClick={() => {
                setRole("ADMIN");
                setStep("FORM_INPUT");
              }}
              className="w-full p-4 rounded-lg bg-white border border-stone-300 hover:border-teal-800 text-left flex items-center gap-3 transition-colors"
            >
              <span className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
                <UserCog className="w-5 h-5" />
              </span>
              <span>
                <span className="block text-[14px] font-bold text-stone-900">Continue as Admin</span>
                <span className="block text-xs text-stone-500 mt-0.5">Allocations, rooms &amp; requests</span>
              </span>
              <ChevronRight className="w-4 h-4 text-stone-400 ml-auto" />
            </button>
          </div>
        ) : (
          <div>
            <h2 className="text-[16px] font-bold text-stone-900 text-center">
              {role === "ADMIN" ? "Admin details" : "Student details"}
            </h2>
            <p className="text-stone-600 text-sm mt-1 mb-6 text-center">
              Enter your name and email to proceed.
            </p>

            <form onSubmit={handleDevSignIn} className="space-y-4">
              <div>
                <label className={labelCls}>Full name</label>
                <input
                  type="text"
                  placeholder="E.g., Ananya Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Email address</label>
                <input
                  type="email"
                  placeholder="E.g., aditi@yourinstitution.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={inputCls}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full font-semibold py-3 px-5 rounded-lg text-sm disabled:opacity-60"
              >
                {loading ? "Signing in…" : "Log in"}
              </button>

              <button
                type="button"
                onClick={() => setStep("ROLE_SELECT")}
                className="w-full text-stone-500 hover:text-stone-800 py-2 text-sm font-medium transition-colors"
              >
                ← Back to role selection
              </button>
            </form>
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-stone-500 border-t border-stone-200 pt-4">
          <ShieldCheck className="w-4 h-4 text-teal-800" />
          <span>Local development sign-in</span>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Log in to RoomFit"
      subtitle="Choose your role, then sign in with your institution account."
    >
      {/* Role toggle */}
      <div className="flex bg-stone-100 p-1 rounded-lg mb-6">
        <button
          onClick={() => setRole("STUDENT")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-semibold transition-colors ${
            role === "STUDENT"
              ? "text-stone-900 bg-white shadow-sm"
              : "text-stone-500 hover:text-stone-800"
          }`}
        >
          <User className="w-4 h-4" /> Student
        </button>
        <button
          onClick={() => setRole("ADMIN")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-semibold transition-colors ${
            role === "ADMIN"
              ? "text-stone-900 bg-white shadow-sm"
              : "text-stone-500 hover:text-stone-800"
          }`}
        >
          <UserCog className="w-4 h-4" /> Admin
        </button>
      </div>

      {!demoMode ? (
        <button
          onClick={handleSignIn}
          disabled={loading}
          className="btn-primary w-full font-semibold py-3 px-5 rounded-lg text-sm flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            "Signing in…"
          ) : (
            <>
              <span className="bg-white p-1 rounded">
                <svg
                  viewBox="0 0 24 24"
                  className="w-4 h-4 flex-shrink-0"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.86C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.05H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.95l3.66-2.86z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.86c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              </span>
              Sign in with your institution account
            </>
          )}
        </button>
      ) : (
        <form onSubmit={handleDemoSignIn} className="space-y-4">
          <input
            type="email"
            placeholder="E.g., student0@yourdomain.edu"
            value={demoEmail}
            onChange={(e) => setDemoEmail(e.target.value)}
            required
            className={inputCls}
          />
          <input
            type="password"
            placeholder="Enter password"
            value={demoPassword}
            onChange={(e) => setDemoPassword(e.target.value)}
            required
            className={inputCls}
          />
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full font-semibold py-3 px-5 rounded-lg text-sm disabled:opacity-50"
          >
            {loading ? "Authenticating…" : "Sign in"}
          </button>
        </form>
      )}

      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-stone-500">
        <ShieldCheck className="w-4 h-4 text-teal-800" />
        <span>Restricted to your institution&apos;s email domain</span>
        {/* Manual override toggle */}
        <button
          onClick={() => setDemoMode(!demoMode)}
          className="ml-auto text-stone-300 hover:text-stone-500 font-bold transition-colors"
          title="Toggle manual sign-in"
          type="button"
        >
          •
        </button>
      </div>
    </AuthShell>
  );
}
