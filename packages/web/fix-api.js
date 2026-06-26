const fs = require('fs');
const path = require('path');

const agentsDir = path.join(__dirname, 'src', 'lib', 'agents');
const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.ts'));

files.forEach(file => {
  const filePath = path.join(agentsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Remove lines like: if (!apiKey || apiKey.trim() === "") { ... }
  content = content.replace(/if\s*\(\s*!apiKey\s*\|\|.*?apiKey.*?\)[\s\S]*?(?=const\s+prompt|let\s+generated|const\s+toneOfVoice|const\s+strategyData)/g, '');
  content = content.replace(/if\s*\(\s*!apiKey.*?\)[\s\S]*?(?=const\s+prompt|let\s+generated)/g, '');

  fs.writeFileSync(filePath, content, 'utf8');
});

console.log('Fixed api keys in agents!');