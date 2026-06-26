#!/usr/bin/env tsx

const BASE_URL = "http://localhost:3000";

function log(step: string, message: string, data?: unknown) {
  const ts = new Date().toISOString();
  console.log(`\n[${ts}] [${step}] ${message}`);
  if (data !== undefined) {
    console.log(JSON.stringify(data, null, 2));
  }
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(
      `${options?.method ?? "GET"} ${path} → ${res.status} ${res.statusText}\n${JSON.stringify(body)}`
    );
  }

  return body;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("=== E2E TEST BAŞLADI ===");

  // 1. Marka oluştur
  log("ADIM 1", "Marka oluşturuluyor...");
  const brand = await apiFetch("/api/brands", {
    method: "POST",
    body: JSON.stringify({
      name: "Test Markası",
      websiteUrl: "https://google.com",
    }),
  });
  log("ADIM 1", `Marka oluşturuldu. ID: ${brand.id}`, brand);

  const brandId = brand.id as number;

  // 2. Plan oluştur
  log("ADIM 2", "Plan oluşturuluyor...");
  const now = new Date();
  const plan = await apiFetch("/api/plans", {
    method: "POST",
    body: JSON.stringify({
      brandId,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      clientBrief: "E2E test için otomatik oluşturulmuş plan.",
    }),
  });
  log("ADIM 2", `Plan oluşturuldu. ID: ${plan.id}`, plan);

  const planId = plan.id as number;

  // 3. Fikir üretimini tetikle
  log("ADIM 3", `Fikir üretimi tetikleniyor... (planId: ${planId})`);
  const ideateResult = await apiFetch(`/api/plans/${planId}/ideate`, {
    method: "POST",
  });
  log("ADIM 3", "Fikir üretimi başlatıldı.", ideateResult);

  // 4. Arka plan işlemlerinin tamamlanmasını bekle
  const WAIT_MS = 180_000;
  log("ADIM 4", `Arka plan işlemleri için ${WAIT_MS / 1000} saniye bekleniyor...`);
  await sleep(WAIT_MS);
  log("ADIM 4", "Bekleme tamamlandı.");

  // 5. Görsel üretimini tetikle
  log("ADIM 5", `Görsel üretimi tetikleniyor... (planId: ${planId})`);
  const imagesResult = await apiFetch(`/api/plans/${planId}/generate-images`, {
    method: "POST",
  });
  log("ADIM 5", "Görsel üretimi başlatıldı.", imagesResult);

  // 6. Tamamlandı
  console.log("\n=== TEST TAMAMLANDI ===");
  console.log(`Marka ID : ${brandId}`);
  console.log(`Plan  ID : ${planId}`);
}

main().catch((err) => {
  console.error("\n[HATA]", err.message ?? err);
  process.exit(1);
});
