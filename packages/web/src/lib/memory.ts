import prisma from "./db";

// ─── BrandMemory Utility ──────────────────────────────────────────────────────
//
// Archivist'in yazdığı aylık öğrenimleri ajanların prompt'una inject eder.
// Her ajan çağrısından önce getBrandContext() çağırılır; sonuç prompt'a eklenir.
// Archivist henüz çalışmamışsa boş string döner — ajan sessizce devam eder.
//

interface MemoryLearnings {
  topFormats?:           string[];
  failedApproaches?:     string[];
  audienceInsights?:     string[];
  nextMonthPriorities?:  string[];
  creativeNotes?:        string;
  stats?: {
    total?:      number;
    approved?:   number;
    published?:  number;
    rejected?:   number;
    avgQuality?: number;
  };
}

interface BrandMemoryRecord {
  month:     number;
  year:      number;
  learnings: MemoryLearnings;
}

// Son N ayın hafıza kayıtlarını çeker (parse edilmiş)
async function getRecentMemories(
  brandId: number,
  n = 3,
): Promise<BrandMemoryRecord[]> {
  const rows = await prisma.brandMemory.findMany({
    where: { brandId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    take: n,
  });

  return rows.flatMap((row) => {
    try {
      const parsed = JSON.parse(row.learnings) as MemoryLearnings;
      return [{ month: row.month, year: row.year, learnings: parsed }];
    } catch {
      return [];
    }
  });
}

const MONTH_NAMES = [
  "", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function formatLearnings(record: BrandMemoryRecord): string {
  const { month, year, learnings: l } = record;
  const monthName = MONTH_NAMES[month] ?? `Ay ${month}`;
  const lines: string[] = [`### ${monthName} ${year} Öğrenimleri`];

  if (l.stats) {
    lines.push(
      `İstatistik: ${l.stats.total ?? "?"} içerik — ` +
      `%${l.stats.total ? Math.round(((l.stats.approved ?? 0) / l.stats.total) * 100) : "?"}  onay oranı, ` +
      `ort. kalite ${l.stats.avgQuality ?? "?"}/100`
    );
  }
  if (l.topFormats?.length) {
    lines.push(`İyi çalışan formatlar: ${l.topFormats.join(" • ")}`);
  }
  if (l.failedApproaches?.length) {
    lines.push(`İşe yaramayan yaklaşımlar: ${l.failedApproaches.join(" • ")}`);
  }
  if (l.audienceInsights?.length) {
    lines.push(`Hedef kitle içgörüleri: ${l.audienceInsights.join(" • ")}`);
  }
  if (l.nextMonthPriorities?.length) {
    lines.push(`Bu ay öncelikler: ${l.nextMonthPriorities.join(" • ")}`);
  }
  if (l.creativeNotes) {
    lines.push(`Yaratıcı not: ${l.creativeNotes}`);
  }

  return lines.join("\n");
}

// ─── Ana Fonksiyon ────────────────────────────────────────────────────────────
//
// Kullanım (herhangi bir ajan içinde):
//   import { getBrandContext } from "../memory";
//   const memory = await getBrandContext(brand.id);
//   const prompt = `...${memory ? `\n\n${memory}` : ""}`;
//

export async function getBrandContext(
  brandId: number,
  months = 3,
): Promise<string> {
  try {
    const records = await getRecentMemories(brandId, months);
    if (!records.length) return "";

    const header = `── Marka Hafızası (Son ${records.length} Ay) ──────────────────────────────`;
    const footer = `─────────────────────────────────────────────────────────────────────────`;
    const body   = records.map(formatLearnings).join("\n\n");

    return `${header}\n${body}\n${footer}`;
  } catch {
    return "";
  }
}

// Belirli bir ay için hafıza kaydının var olup olmadığını kontrol eder
export async function hasMemoryForMonth(
  brandId: number,
  month: number,
  year: number,
): Promise<boolean> {
  const count = await prisma.brandMemory.count({
    where: { brandId, month, year },
  });
  return count > 0;
}
