import { NextResponse } from "next/server";
import { ProductCuratorAgent } from "@/lib/agents/ProductCurator";
import { authorizeBrand } from "@/lib/authz";
import { rateLimitOrError } from "@/lib/rateLimit";
import { logBgError } from "@/lib/bgError";

// POST /api/brands/[id]/sync-products
// Markanın web sitesindeki ürün kataloğunu yeniden tarar; yeni yüklenen
// ürünleri tespit edip Gemini Vision ile analiz ederek görsel hafızaya kaydeder.
// Mevcut (analiz edilmiş) ürünler korunur — sadece yeniler işlenir.

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const brandId = parseInt(id);

    const az = await authorizeBrand(brandId);
    if (!az.ok) return az.error;

    // Maliyet-DoS koruması — Vision analizi pahalı, org başına sınırla
    const limited = rateLimitOrError(`ai:${az.orgId}`, 30, 600_000);
    if (limited) return limited;

    // Arka planda çalıştır — vision analizi uzun sürebilir
    new ProductCuratorAgent().execute(brandId).catch(logBgError("Ürün senkronizasyonu", "Brand", brandId));

    return NextResponse.json({
      message: "Ürün senkronizasyonu arka planda başlatıldı. Yeni ürünler analiz edilip hafızaya kaydedilecek.",
    });
  } catch {
    return NextResponse.json({ error: "Ürün senkronizasyonu başlatılamadı." }, { status: 500 });
  }
}
