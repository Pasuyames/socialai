// CJS karsiligi: src/lib/reports.ts (REPORTS_DIR + ensureReportsDir) — script'lerin
// TypeScript derlemeden ayni depolama yoluna yazabilmesi icin.
const path = require("path");
const fs = require("fs");

const REPORTS_DIR = path.join(__dirname, "storage", "reports");

function ensureReportsDir() {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

module.exports = { REPORTS_DIR, ensureReportsDir };
