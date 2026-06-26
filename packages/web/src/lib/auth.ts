import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "./db";
import { rateLimit, resetRateLimit } from "./rateLimit";

// Login brute-force koruması: email başına 15 dk'da 8 başarısız deneme
const LOGIN_LIMIT = 8;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// Üretimde AUTH_SECRET zorunlu — eksikse JWT imzalama güvensiz olur, uygulama açılmamalı
if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) {
  throw new Error("AUTH_SECRET üretim ortamında zorunludur — eksik. Uygulama başlatılamadı.");
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    newUser: "/register",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Şifre", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = (credentials.email as string).toLowerCase().trim();

        // Brute-force koruması — email başına başarısız deneme limiti
        const rl = rateLimit(`login:${email}`, LOGIN_LIMIT, LOGIN_WINDOW_MS);
        if (!rl.allowed) {
          throw new Error("Çok fazla başarısız deneme. Lütfen birkaç dakika sonra tekrar deneyin.");
        }

        const user = await prisma.user.findUnique({
          where: { email },
          include: { organization: true },
        });

        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash,
        );
        if (!valid) return null;

        // Başarılı giriş → deneme sayacını sıfırla
        resetRateLimit(`login:${email}`);

        return {
          id: String(user.id),
          email: user.email,
          name: user.name ?? user.email,
          role: user.role,
          organizationId: String(user.organizationId),
          organizationSlug: user.organization.slug,
          organizationPlan: user.organization.plan,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.organizationId = (user as any).organizationId;
        token.organizationSlug = (user as any).organizationSlug;
        token.organizationPlan = (user as any).organizationPlan;
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.sub as string;
        (session.user as any).role = token.role;
        (session.user as any).organizationId = token.organizationId;
        (session.user as any).organizationSlug = token.organizationSlug;
        (session.user as any).organizationPlan = token.organizationPlan;
      }
      return session;
    },
  },
});
