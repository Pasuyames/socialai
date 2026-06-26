import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authorizePlan } from "@/lib/authz";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const planId = parseInt(resolvedParams.id);

    const az = await authorizePlan(planId);
    if (!az.ok) return az.error;

    // 1. Önce plana bağlı olan tüm postları (gönderileri) sil ki veritabanı ilişkisi bozulmasın
    await prisma.post.deleteMany({
      where: { planId }
    });

    // 2. Ardından planın kendisini sil
    await prisma.monthlyPlan.delete({
      where: { id: planId }
    });

    return NextResponse.json({ success: true, message: "Plan başarıyla silindi." });
  } catch (error) {
    console.error("Plan silme hatası:", error);
    return NextResponse.json({ error: "Plan silinirken sunucu hatası oluştu." }, { status: 500 });
  }
}
