import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

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
      const demoPassword = process.env.DEMO_BYPASS_PASSWORD;
      // Domain/tenant membership is no longer checked here with a hardcoded
      // string - the shared signIn() callback below enforces it for every
      // provider (this one included) via the backend's real
      // Organization.allowedEmailDomains lookup.
      if (
        demoPassword &&
        credentials?.password === demoPassword &&
        credentials?.email
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

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: IS_DEV_AUTH ? [DevAuthProvider] : ProdAuthProviders,
  callbacks: {
    // STEP 1: Runs right after provider confirms the user ──────────────
    async signIn({ user }) {
      // Domain/tenant membership is resolved by ONE real check - the
      // backend's Organization.allowedEmailDomains lookup inside
      // /api/auth/sync-user (see backend/routes/auth.js) - instead of a
      // hardcoded @sitpune.edu.in string here and a second one inside the
      // Demo Bypass provider's authorize() above. This applies uniformly to
      // every provider, DEV_AUTH included: a dev-login still has to belong
      // to a real, registered organization's domain, same as production
      // would (see the matching comment in backend/routes/auth.js).
      //
      // A non-OK response (unrecognized domain, or the backend being
      // unreachable) now denies sign-in rather than silently letting it
      // through - this IS a behavior change from before ("don't block
      // sign-in if sync fails"), but for a tenant-membership gate, failing
      // open on a backend outage is a bigger risk than a temporary lockout.
      try {
        // No role is sent here anymore - the backend never reads it from
        // the request body (see backend/routes/auth.js), so sending the
        // login form's selection or the selectedRole cookie would just be
        // misleading dead weight.
        const syncRes = await fetch(`${BACKEND_URL}/api/auth/sync-user`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: user.email,
            name: user.name,
            image: user.image,
          }),
        });

        if (!syncRes.ok) {
          return "/unauthorized";
        }

        // The role that actually matters from here on is the REAL,
        // DB-persisted one sync-user just returned - never the login form's
        // selection or the selectedRole cookie. Overwriting it here means
        // the jwt() callback below (which reads user.role) picks up the real
        // value instead of whatever the client originally claimed, so a
        // student who selects "Admin" at the role picker gets a session that
        // correctly says STUDENT, not a session that trusts their own pick.
        const syncedUser = await syncRes.json();
        (user as any).role = syncedUser.role;
      } catch (err) {
        console.error("[sync-user] Failed to sync to backend:", err);
        return "/unauthorized";
      }

      return true;
    },

    // Attach role to JWT token ──────────────────────────────
    async jwt({ token, user }) {
      if (user) {
        // signIn() above always runs first and, on success, has already
        // overwritten user.role with the real, DB-persisted value - this is
        // never the client's original form selection or a cookie by the
        // time we get here (signIn returning a redirect string instead of
        // true would have aborted the sign-in entirely, so jwt() only ever
        // runs after that real value was set).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.role = ((user as any).role || "STUDENT").toUpperCase();
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
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };