"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ShieldCheck, Building2, Check, AlertTriangle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import axios from "axios";
import { API_URL } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [domain, setDomain] = useState("");
  const [founderName, setFounderName] = useState("");
  const [founderEmail, setFounderEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canSubmit = orgName.trim() && domain.trim() && founderName.trim() && founderEmail.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      // Public, unauthenticated endpoint - there's no session yet at this
      // point, so this goes straight to the backend (API_URL), not through
      // the authenticated proxy (which requires a session to already exist).
      await axios.post(`${API_URL}/api/auth/register-organization`, {
        orgName: orgName.trim(),
        domain: domain.trim(),
        founderName: founderName.trim(),
        founderEmail: founderEmail.trim(),
      });
      setSuccess(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create organization. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center relative overflow-hidden">
      <div className="absolute top-0 right-0 w-full h-[60vh] bg-gradient-to-b from-violet-100/40 to-transparent pointer-events-none" />

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
          <div className="text-center mb-6">
            <span className="font-serif text-2xl font-semibold text-slate-700 tracking-tight">
              Room<span className="text-orange-500">Sync</span>
            </span>
            <p className="text-xs text-slate-400 mt-1">Hostel Management Platform</p>
          </div>

          <div className="bg-white px-10 py-12 rounded-[2rem] shadow-[0_10px_50px_rgba(0,0,0,0.05)] border border-slate-100">
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 }}
              className="mx-auto bg-violet-100 text-violet-600 p-4 rounded-full w-20 h-20 flex items-center justify-center mb-6"
            >
              <Building2 className="w-10 h-10" />
            </motion.div>

            <h1 className="text-2xl font-bold text-slate-800 mb-2 text-center">
              Create Your Organization
            </h1>
            <p className="text-slate-500 text-sm text-center leading-relaxed mb-8 px-2">
              Set up RoomSync for your institution. Your email domain becomes the gate for
              everyone else who signs in — only your organization&apos;s addresses will be accepted.
            </p>

            {success ? (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-6 rounded-2xl text-center space-y-4">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto border border-emerald-200 shadow-sm">
                  <Check size={20} className="text-emerald-600" />
                </div>
                <p className="text-sm font-medium leading-relaxed">
                  Organization created. You&apos;re registered as the founding administrator for{" "}
                  <span className="font-semibold">{domain.trim()}</span>.
                </p>
                <button
                  onClick={() => router.push("/login")}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-full transition-all flex items-center justify-center gap-2"
                >
                  Log in now <ChevronRight size={16} />
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-start gap-3 text-xs leading-relaxed">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g. Acme Engineering College"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:bg-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    Email Domain
                  </label>
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="e.g. acme.edu"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:bg-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Only accounts ending in this domain will be able to sign in.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={founderName}
                    onChange={(e) => setFounderName(e.target.value)}
                    placeholder="e.g. Jordan Lee"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:bg-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    Your Email
                  </label>
                  <input
                    type="email"
                    value={founderEmail}
                    onChange={(e) => setFounderEmail(e.target.value)}
                    placeholder="e.g. jordan@acme.edu"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:bg-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Must belong to the domain above — this becomes your founding admin account.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !canSubmit}
                  className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-4 px-6 rounded-xl transition-all duration-300 shadow-md hover:shadow-lg"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Create Organization
                      <ChevronRight className="w-5 h-5 ml-1 opacity-70" />
                    </>
                  )}
                </button>
              </form>
            )}

            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>One founding admin per organization — invite teammates later</span>
            </div>

            <div className="mt-4 text-center">
              <span className="text-xs text-slate-400">Already have an organization? </span>
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
