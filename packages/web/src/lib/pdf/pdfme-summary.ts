/**
 * pdfme ile hızlı kampanya özet raporu.
 * JSON template tabanlı — gelecekte DB'de client-specific şablonlar saklanabilir.
 * Mevcut pdf-lib tam raporu yanında isteğe bağlı kullanılır.
 */
import { generate } from "@pdfme/generator";
import { BLANK_PDF } from "@pdfme/common";
import type { Template } from "@pdfme/common";
import path from "path";
import fs from "fs";

export interface SummaryReportData {
  brandName:  string;
  month:      string;
  year:       number;
  brandColor: string;
  posts: {
    platform:    string;
    topic:       string;
    caption:     string;
    scheduledAt: string;
    status:      string;
    likes?:      number;
    comments?:   number;
    reach?:      number;
  }[];
  totalPosts:    number;
  publishedCount: number;
  avgLikes:      number;
}

// ─── pdfme Template ──────────────────────────────────────────────────────────

function buildTemplate(data: SummaryReportData): Template {
  const rowHeight = 12;
  const headerY   = 80;
  const startY    = headerY + rowHeight + 4;
  const maxRows   = Math.min(data.posts.length, 20);

  const schemas: Template["schemas"] = [
    [
      // Başlık
      {
        name: "title",
        type: "text",
        position: { x: 10, y: 10 },
        width: 190,
        height: 12,
        fontSize: 14,
        fontColor: "#ffffff",
        backgroundColor: data.brandColor || "#1a1a2e",
        fontName: "Helvetica-Bold",
        alignment: "center",
        content: `${data.brandName} — ${data.month} ${data.year} Özet`,
      },
      // İstatistik kartları
      {
        name: "stat1",
        type: "text",
        position: { x: 10, y: 30 },
        width: 55,
        height: 20,
        fontSize: 9,
        fontColor: "#333333",
        content: `Toplam Post\n${data.totalPosts}`,
        alignment: "center",
      },
      {
        name: "stat2",
        type: "text",
        position: { x: 78, y: 30 },
        width: 55,
        height: 20,
        fontSize: 9,
        fontColor: "#333333",
        content: `Yayınlanan\n${data.publishedCount}`,
        alignment: "center",
      },
      {
        name: "stat3",
        type: "text",
        position: { x: 146, y: 30 },
        width: 55,
        height: 20,
        fontSize: 9,
        fontColor: "#333333",
        content: `Ort. Beğeni\n${data.avgLikes}`,
        alignment: "center",
      },
      // Tablo başlığı
      {
        name: "tableHeader",
        type: "text",
        position: { x: 10, y: headerY },
        width: 190,
        height: rowHeight,
        fontSize: 8,
        fontName: "Helvetica-Bold",
        fontColor: "#ffffff",
        backgroundColor: "#444444",
        content: "Platform   Konu                                Tarih       Durum      Beğeni  Reach",
      },
      // Post satırları
      ...data.posts.slice(0, maxRows).map((post, i) => ({
        name: `row_${i}`,
        type: "text" as const,
        position: { x: 10, y: startY + i * rowHeight },
        width: 190,
        height: rowHeight,
        fontSize: 7,
        fontColor: "#333333",
        backgroundColor: i % 2 === 0 ? "#f9f9f9" : "#ffffff",
        content: [
          (post.platform ?? "").slice(0, 9).padEnd(10),
          (post.topic ?? "").slice(0, 34).padEnd(35),
          (post.scheduledAt ?? "").slice(0, 10).padEnd(12),
          (post.status ?? "").slice(0, 10).padEnd(12),
          String(post.likes ?? "-").padEnd(8),
          String(post.reach ?? "-"),
        ].join(""),
      })),
    ],
  ];

  return {
    basePdf: BLANK_PDF,
    schemas,
  };
}

// ─── Rapor Üretimi ────────────────────────────────────────────────────────────

export async function generateSummaryPdf(
  data: SummaryReportData,
  outputDir: string,
): Promise<string> {
  const template = buildTemplate(data);
  const inputs   = [{}]; // şablondaki content alanları statik

  const pdf = await generate({ template, inputs });

  const fileName = `summary-${data.brandName.replace(/\s+/g, "-").toLowerCase()}-${data.month}-${data.year}.pdf`;
  const filePath = path.join(outputDir, fileName);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(filePath, pdf);

  // Sadece dosya adı döner — erişim yetkili route üzerinden yapılır
  return fileName;
}
