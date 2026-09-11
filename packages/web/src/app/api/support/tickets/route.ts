import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { authorize } from "@/lib/authz";
import { rateLimitOrError } from "@/lib/rateLimit";

// ─── Girdi doğrulama ─────────────────────────────────────────────────────────
//
// Bu uç eskiden gövdeyi HAM kabul ediyordu. Sondajla doğrulanan sonuçlar:
//   priority:"ULTRA-KRITIK-HACK"  → 201 (şema dışı değer DB'ye yazılıyordu;
//                                   admin panelindeki sıralama/filtreyi bozar)
//   category:"<script>…"          → 201 (şema dışı değer; React render'da
//                                   kaçırsa da veri kirleniyor ve ileride
//                                   PDF/e-posta gibi HTML-dışı bir tüketiciye
//                                   sızabilir)
//   5000 karakterlik subject      → 201 (DB şişirme)
//   subject bir OBJE              → 500 (yakalanmamış Prisma hatası)
//   bozuk JSON                    → 500 (req.json() fırlatıyordu)
// Enum değerleri prisma/schema.prisma'daki yorumlarla birebir aynı tutulmalı.
const CATEGORIES = ["general", "billing", "bug", "feature"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

const TicketSchema = z.object({
  subject:  z.string().trim().min(1, "Konu zorunludur.").max(200, "Konu en fazla 200 karakter olabilir."),
  body:     z.string().trim().min(1, "Mesaj zorunludur.").max(5000, "Mesaj en fazla 5000 karakter olabilir."),
  category: z.enum(CATEGORIES, { error: "Geçersiz kategori." }).optional(),
  priority: z.enum(PRIORITIES, { error: "Geçersiz öncelik." }).optional(),
});

export async function GET() {
  const az = await authorize();
  if (!az.ok) return az.error;

  const tickets = await prisma.supportTicket.findMany({
    where: az.isAdmin && !az.orgId ? {} : { organizationId: az.orgId },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(tickets);
}

export async function POST(req: NextRequest) {
  try {
    const az = await authorize();
    if (!az.ok) return az.error;

    // Org'suz bir oturum (ör. org'u olmayan superadmin) bilet AÇAMAZ:
    // organizationId NaN olarak yazılırsa Prisma patlar.
    if (!Number.isInteger(az.orgId)) {
      return NextResponse.json({ error: "Bilet açmak için bir organizasyona bağlı olmalısınız." }, { status: 403 });
    }

    // Bilet spam'ini sınırla (org başına 20 / saat).
    const limited = rateLimitOrError(`ticket:${az.orgId}`, 20, 60 * 60 * 1000);
    if (limited) return limited;

    const parsed = TicketSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Geçersiz istek gövdesi." },
        { status: 400 },
      );
    }
    const { subject, body, category, priority } = parsed.data;

    const ticket = await prisma.supportTicket.create({
      data: {
        organizationId: az.orgId,
        userId:         az.userId,
        subject,
        category: category ?? "general",
        priority: priority ?? "normal",
        status:   "open",
        messages: { create: { authorId: az.userId, isAdmin: false, body } },
      },
      include: { messages: true },
    });

    return NextResponse.json(ticket, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Bilet oluşturulamadı." }, { status: 500 });
  }
}
