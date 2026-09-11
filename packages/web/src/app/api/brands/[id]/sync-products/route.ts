import { NextResponse } from "next/server";
import { ProductCuratorAgent } from "@/lib/agents/ProductCurator";
import { authorizeBrand } from "@/lib/authz";
import { rateLimitOrError } from "@/lib/rateLimit";
import { logBgError } from "@/lib/bgError";

// POST /api/brands/[id]/sync-products
//
// Markanın web sitesindeki ürün kataloğunu yeniden tarar.
//
// İki ayrı maliyet profili vardır ve karıştırılmamalıdır:
//
//   downloadImages (varsayılan AÇIK, LLM maliyeti YOK)
//     Ürün paketi görsellerini indirir. ImageGenerator'ın "gerçek paketi
//     referans ver" modunun ÖN KOŞULUDUR — bu kapalıyken sistem sessizce
//     metin→görsele düşer ve "ürünü görerek üret" özelliği çalışmaz.
//     Bu bayrak eskiden kodda `false` olarak SABİTLENMİŞTİ; özellik bu yüzden
//     yapısal olarak erişilemezdi.
//
//   analyzeImages (varsayılan KAPALI, ÜCRETLİ)
//     Yeni ürünleri Gemini Vision ile analiz edip "nasıl göründüklerini"
//     (ambalaj, renk, etiket stili) marka hafızasına yazar. Ürün başına bir
//     Vision çağrısı demektir → açık rıza gerektirir:
//         POST /api/brands/5/sync-products   { "analyzeImages": true }
//
// Mevcut (analiz edilmiş) ürünler korunur — sadece yeniler işlenir.

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const brandId = parseInt(id);

    const az = await authorizeBrand(brandId);
    if (!az.ok) return az.error;

    // Maliyet-DoS koruması — org başına sınırla
    const limited = rateLimitOrError(`ai:${az.orgId}`, 30, 600_000);
    if (limited) return limited;

    // Gövde opsiyoneldir; yoksa güvenli varsayılanlar kullanılır.
    const body = (await req.json().catch(() => ({}))) as {
      downloadImages?: unknown;
      analyzeImages?: unknown;
    };
    const downloadImages = body?.downloadImages === false ? false : true;
    const analyzeImages  = body?.analyzeImages === true;

    // Arka planda çalıştır — indirme ve (açıksa) vision analizi uzun sürebilir
    new ProductCuratorAgent()
      .execute(brandId, { downloadImages, analyzeImages })
      .catch(logBgError("Ürün senkronizasyonu", "Brand", brandId));

    return NextResponse.json({
      message: "Ürün senkronizasyonu arka planda başlatıldı.",
      downloadImages,
      analyzeImages,
      not: analyzeImages
        ? "Vision analizi AÇIK — ürün başına ücretli çağrı yapılacak."
        : "Vision analizi kapalı (ücretsiz). Görsel hafıza için analyzeImages:true gönderin.",
    });
  } catch {
    return NextResponse.json({ error: "Ürün senkronizasyonu başlatılamadı." }, { status: 500 });
  }
}
