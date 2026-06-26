const fs = require('fs');

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Fix extra closing bracket before Prisma update
    content = content.replace(/cleanedJsonStr = responseText.*?trim\(\);\n\s*}\n\n\s*\/\/\ 4\./, 'cleanedJsonStr = responseText.replace(/```json/g, "").replace(/```/g, "").trim();\n\n      // 4.');

    // Restore rawData parsing
    content = content.replace(/let cleanedJsonStr = "";/g, 'let cleanedJsonStr = "";\n      const rawData = JSON.parse(brand.rawScrapedData as string);');
    
    fs.writeFileSync(filePath, content, 'utf8');
}

fixFile('C:\\Users\\musta\\Desktop\\SocialAI\\web\\src\\lib\\agents\\BrandStrategist.ts');
fixFile('C:\\Users\\musta\\Desktop\\SocialAI\\web\\src\\lib\\agents\\ToneOfVoiceSpecialist.ts');
