const fs = require('fs');

const path = "C:\\Users\\musta\\Desktop\\SocialAI\\web\\src\\app\\(dashboard)\\plans\\[id]\\page.tsx";
let content = fs.readFileSync(path, 'utf8');

// fix the import
content = content.replace(
  'import { ArrowLeft, CalendarDays, Activity, BrainCircuit, Hash, Palette, Download } from "lucide-react";',
  'import { ArrowLeft, CalendarDays, Activity, BrainCircuit, Hash, Palette, Download, Send } from "lucide-react";'
);

fs.writeFileSync(path, content, 'utf8');
console.log("Fixed lucide-react Send import.");