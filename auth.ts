import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import {
  passwordLogin,
  emailCodeLogin,
  verifiedUser,
} from "@/lib/server/auth-service";
export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/", error: "/" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID || "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET || "",
      authorization: { params: { prompt: "select_account" } },
    }),
    Credentials({
      id: "admin",
      name: "Administrador",
      credentials: { username: {}, password: {} },
      async authorize(c) {
        try {
          return await passwordLogin(c.username, c.password);
        } catch {
          return null;
        }
      },
    }),
    Credentials({
      id: "email-code",
      name: "Código por e-mail",
      credentials: { email: {}, code: {} },
      async authorize(c) {
        try {
          return await emailCodeLogin(c.email, c.code);
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        if (!profile?.email || profile.email_verified !== true) return false;
        const stored = await verifiedUser(profile.email, profile.name);
        user.id = stored.id;
        user.email = stored.email;
      }
      return !!user.id;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.sub = user.id;
        token.authMethod = account?.provider;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
      }
      session.authMethod = String(token.authMethod || "");
      return session;
    },
  },
  logger: {
    error() {
      console.error(
        "Authentication failed; check server configuration and database availability.",
      );
    },
  },
});
