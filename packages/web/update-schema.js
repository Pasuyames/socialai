const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

// Add memories to Brand
schema = schema.replace(
  'plans            MonthlyPlan[]',
  'plans            MonthlyPlan[]\n  memories         BrandMemory[]'
);

// Add trendReport and directorBrief to MonthlyPlan
schema = schema.replace(
  'clientBrief     String?   // M\u01ECl\u015Fterinin \u00F6zel notlar\u0131',
  'clientBrief     String?   // Müşterinin özel notları\n  trendReport     String?   // Data Analyst trend raporu\n  directorBrief   String?   // Marketing Director aylık stratejisi'
);

// Append BrandMemory model
schema += `

// ==================== MARKA HAFIZASI (MEMORY) ====================
model BrandMemory {
  id              Int       @id @default(autoincrement())
  brandId         Int
  brand           Brand     @relation(fields: [brandId], references: [id])
  month           Int
  year            Int
  
  learnings       String    // Ajanlarin bu aydan ogrendikleri (Neler tuttu, ne sevilmedi vs. JSON formatinda)
  createdAt       DateTime  @default(now())
}
`;

fs.writeFileSync(schemaPath, schema, 'utf8');
console.log('Schema updated.');
