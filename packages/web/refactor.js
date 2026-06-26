const fs = require('fs');
const path = require('path');

const agentsDir = path.join(__dirname, 'src', 'lib', 'agents');
const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.ts'));

files.forEach(file => {
  const filePath = path.join(agentsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Remove import
  content = content.replace(/import\s+{\s*GoogleGenerativeAI\s*}\s*from\s*"@google\/generative-ai";\n?/g, '');
  
  // Add new import
  if (!content.includes('import { generateText }')) {
    content = 'import { generateText } from "../llm";\n' + content;
  }

  // Remove API key check
  content = content.replace(/const\s+apiKey\s*=\s*process\.env\.GEMINI_API_KEY;?\n?/g, '');
  content = content.replace(/if\s*\(!apiKey.*\s*{\s*throw\s*new\s*Error.*GEMINI_API_KEY.*;\s*}\n?/g, '');

  // Replace old generation logic with generic one
  const regex = /const\s+genAI\s*=\s*new\s*GoogleGenerativeAI\([^)]+\);[\s\S]*?const\s+result\s*=\s*await\s+model\.generateContent\([^)]+\);[\s\S]*?const\s+cleanedJsonStr\s*=\s*result\.response\.text\(\)\.replace\([^;]+;/g;
  
  if (content.match(regex)) {
      content = content.replace(regex, `const cleanedJsonStr = await generateText(prompt, true);`);
  } else {
      // Non-json returns (text)
      const textRegex = /const\s+genAI\s*=\s*new\s*GoogleGenerativeAI\([^)]+\);[\s\S]*?const\s+result\s*=\s*await\s+model\.generateContent\([^)]+\);[\s\S]*?const\s+(\w+)\s*=\s*result\.response\.text\(\);/g;
      
      content = content.replace(textRegex, `const $1 = await generateText(prompt, false);`);
  }

  fs.writeFileSync(filePath, content, 'utf8');
});

console.log('All agents updated!');