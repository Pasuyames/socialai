// ─── Kimlik Kapısı (Next 16 "proxy" dosya konvansiyonu) ──────────────────────
//
// Bu dosya eskiden src/middleware.ts idi. Next 16.2.9 "middleware" konvansiyonunu
// deprecate edip yerine "proxy"yi koydu (dev sunucusu her açılışta uyarıyordu);
// imza ve davranış aynı, yalnızca dosya adı değişti. Gelecek bir major'da eski ad
// tamamen kalkacağı için şimdiden taşındı.
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/client",
  "/api/auth",
  "/api/client",   // müşteri portalı (token ile yetkilendirilir)
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  // NOT: "reports" artık dışlanmıyor — rapor PDF'leri public/ dışında tutulur ve
  // yalnızca yetkili API route'ları (authorizePlan / client token) ile servis edilir.
  //
  // NOT: "uploads" ve "scraped-products" dışlanır — müşteri portalına token
  // linkiyle gelen ziyaretçinin oturumu YOKTUR; bu klasörler dışlanmazsa post ve
  // ürün görselleri /login'e 307 yer ve portal bomboş görünür.
  // Güvenlik takası: bu dosyalar artık URL'ini bilen herkese açıktır. Kabul
  // edilebilir, çünkü dosya adları rastgele hex son ek taşır (örn.
  // 1778105545708-1b473383.jpg) → tahmin edilemez, yani rapor PDF'i ve portal
  // token'ı ile aynı "capability URL" modeli. Gizli olması gereken bir dosya
  // asla public/ altına konmamalı, yetkili bir API route'undan stream edilmeli.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logos|images|uploads|scraped-products).*)"],
};
