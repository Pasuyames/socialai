import path from "path";
import fs from "fs";

// ─── Rapor Depolama (public DIŞINDA — auth'suz erişim engellenir) ─────────────
//
// Rapor PDF'leri public/ altında DEĞİL, statik servis edilmeyen özel bir dizinde
// tutulur. Erişim yalnızca yetkili API route'ları üzerinden (authorizePlan veya
// geçerli müşteri token'ı) sağlanır.

export const REPORTS_DIR = path.join(process.cwd(), "storage", "reports");

export function ensureReportsDir(): void {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// Saklanan reportPath değerinden (eski "/reports/x.pdf" veya yeni "x.pdf") güvenli
// mutlak yolu çözer. path traversal'a karşı yalnızca basename kullanılır.
export function resolveReportFile(reportPath: string | null): string | null {
  if (!reportPath) return null;
  const name = path.basename(reportPath);
  if (!name.toLowerCase().endsWith(".pdf")) return null;

  const full = path.resolve(REPORTS_DIR, name);
  if (full !== path.join(REPORTS_DIR, name)) return null; // traversal güvencesi
  return fs.existsSync(full) ? full : null;
}
