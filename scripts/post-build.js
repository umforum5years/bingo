const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '..', 'docs');
const browserDir = path.join(docsDir, 'browser');

// Перемещаем файлы из browser/ в docs/
const files = fs.readdirSync(browserDir);
files.forEach((file) => {
  const srcPath = path.join(browserDir, file);
  const destPath = path.join(docsDir, file);
  fs.renameSync(srcPath, destPath);
});

// Удаляем пустую папку browser
fs.rmdirSync(browserDir);

// Создаём .nojekyll
fs.writeFileSync(path.join(docsDir, '.nojekyll'), '');

console.log('Post-build complete. Files ready for GitHub Pages.');
