const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '..', 'docs');

// Очищаем папку docs перед сборкой
if (fs.existsSync(docsDir)) {
  fs.rmSync(docsDir, { recursive: true, force: true });
  console.log('Cleaned docs directory');
}
