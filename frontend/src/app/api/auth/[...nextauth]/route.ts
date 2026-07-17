import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";
const IS_DEV_AUTH = process.env.NEXT_PUBLIC_DEV_AUTH === "true";

// Dedicated Development Credentials Provider
const DevAuthProvider = CredentialsProvider({
  id: "dev-login",
  name: "Development Login Bypass",
  credentials: {
    name: { label: "Name", type: "text" },
    email: { label: "Email", type: "email" },
    role: { label: "Role", type: "text" },
  },
  async authorize(credentials) {
    if (!credentials?.email || !credentials?.name || !credentials?.role) {
      return null;
    }
    return {
      id: credentials.email,
      email: credentials.email,
      name: credentials.name,
      role: credentials.role.toUpperCase(),
    };
  },
});

// Production Auth Providers (Google & Legacy Demo Bypass)
const ProdAuthProviders = [
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
];

const handler = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  providers: IS_DEV_AUTH ? [DevAuthProvider] : ProdAuthProviders,
  callbacks: {
    // STEP 1: Runs right after provider confirms the user ──────────────
    async signIn({ user, account, profile }) {
      if (!IS_DEV_AUTH && account?.provider === "google") {
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
          (user as any).role || cookieStore.get("selectedRole")?.value || "STUDENT";

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
          (user as any).role || cookieStore.get("selectedRole")?.value || "STUDENT";
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