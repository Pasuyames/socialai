import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

// Girdi doğrulama — geçerli email, güçlü şifre, makul org adı
const RegisterSchema = z.object({
  email:    z.string().trim().toLowerCase().email("Geçerli bir email adresi girin."),
  password: z.string()
    .min(8, "Şifre en az 8 karakter olmalı.")
    .max(128, "Şifre çok uzun.")
    .regex(/[a-z]/, "Şifre en az bir küçük harf içermeli.")
    .regex(/[A-Z]/, "Şifre en az bir büyük harf içermeli.")
    .regex(/[0-9]/, "Şifre en az bir rakam içermeli."),
  orgName:  z.string().trim().min(2, "Organizasyon adı en az 2 karakter olmalı.").max(80),
  name:     z.string().trim().max(80).optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Brute-force / kötüye kullanım: IP başına saatte 5 kayıt
    const ip = getClientIp(req);
    const rl = rateLimit(`register:${ip}`, 5, 60 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Çok fazla kayıt denemesi. ${rl.retryAfter} saniye sonra tekrar deneyin.` },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
      );
    }

    const parsed = RegisterSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Geçersiz giriş.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { email, password, name, orgName } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Bu email zaten kayıtlı." }, { status: 409 });
    }

    const slug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const uniqueSlug = `${slug || "org"}-${Date.now().toString(36)}`;
    const passwordHash = await bcrypt.hash(password, 12);

    const org = await prisma.organization.create({
      data: {
        name: orgName,
        slug: uniqueSlug,
        plan: "starter",        // sabit — istemci değiştiremez
        users: {
          create: {
            email,
            passwordHash,
            name: name ?? email.split("@")[0],
            role: "owner",       // sabit — yetki yükseltme engellenir
          },
        },
      },
    });

    return NextResponse.json({ success: true, orgId: org.id });
  } catch (err) {
    // Ham hata mesajı (DB/stack) istemciye SIZDIRILMAZ
    console.error("[register]", err);
    return NextResponse.json({ error: "Kayıt oluşturulamadı." }, { status: 500 });
  }
}
