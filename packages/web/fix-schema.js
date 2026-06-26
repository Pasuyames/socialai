const fs = require('fs');

const path = 'C:\\Users\\musta\\Desktop\\SocialAI\\web\\prisma\\schema.prisma';
let schema = fs.readFileSync(path, 'utf8');

// Match the exact clientBrief line
schema = schema.replace(
  /clientBrief\s+String\?\s*\/\/\s*M.*?notlar.*?/g,
  `clientBrief     String?   // Musterinin ozel notlari
  trendReport     String?   // Data Analyst trend raporu
  directorBrief   String?   // Marketing Director aylik stratejisi`
);

fs.writeFileSync(path, schema, 'utf8');
console.log('Fixed schema.');
