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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logos|images).*)"],
};
