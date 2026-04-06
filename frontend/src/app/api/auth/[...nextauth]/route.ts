import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

const handler = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "mock-client-id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "mock-client-secret",
    }),
    CredentialsProvider({
      name: "Demo Network Bypass",
      credentials: {
        email: { label: "Mock Student Email", type: "email" },
        password: { label: "Demo Password", type: "password" },
      },
      async authorize(credentials) {
        if (
          credentials?.password === "demo123" &&
          credentials?.email?.endsWith("@sitpune.edu.in")
        ) {
          return {
            id: credentials.email,
            email: credentials.email,
            name: credentials.email.split("@")[0],
          };
        }
        return null;
      },
    }),
  ],
  callbacks: {
    // STEP 1: Runs right after Google confirms the user ──────────────
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        // Block non-SIT emails
        if (
          !profile?.email ||
          !profile.email.endsWith("@sitpune.edu.in")
        ) {
          return "/unauthorized";
        }
      }

      // Sync user to MongoDB via backend ──────────────────────────────
      try {
        const cookieStore = await cookies();
        const roleCookie =
          cookieStore.get("selectedRole")?.value || "STUDENT";

        await fetch(`${BACKEND_URL}/api/auth/sync-user`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: user.email,
            name: user.name,
            image: user.image,
            role: roleCookie.toUpperCase(), // "ADMIN" or "STUDENT"
          }),
        });
      } catch (err) {
        // Don't block sign-in if sync fails — log and continue
        console.error("[sync-user] Failed to sync to backend:", err);
      }

      return true;
    },

    // Attach role to JWT token ──────────────────────────────
    async jwt({ token, user }) {
      if (user) {
        const cookieStore = await cookies();
        const roleCookie =
          cookieStore.get("selectedRole")?.value || "STUDENT";
        token.role = roleCookie.toUpperCase();
      }
      return token;
    },

    //  Expose role on the session object ─────────────────────
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",   // ← updated: login page is now at /login
    error: "/unauthorized",
  },
});

export { handler as GET, handler as POST };