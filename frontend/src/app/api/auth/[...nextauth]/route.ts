import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { cookies } from "next/headers";

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
        password: { label: "Demo Password", type: "password" }
      },
      async authorize(credentials) {
        if (credentials?.password === "demo123" && credentials?.email?.endsWith("@sitpune.edu.in")) { 
          
          return { id: credentials.email, email: credentials.email, name: credentials.email.split('@')[0] };
        }
        // Force authentication failure if password doesn't match the hidden backdoor
        return null;
      }
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        // Restrict to @sitpune.edu.in domain
        if (
          profile?.email &&
          profile.email.endsWith("@sitpune.edu.in")
        ) {
          return true;
        } else {
          return "/unauthorized"; 
        }
      }
      return true;
    },
    async jwt({ token, user, profile }) {
      if (user) {
        // Retrieve the role from the frontend selection
        const cookieStore = await cookies();
        const roleCookie = cookieStore.get("selectedRole")?.value || "STUDENT";
        
        token.role = roleCookie.toUpperCase();
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
    error: "/unauthorized",
  },
});

export { handler as GET, handler as POST };

