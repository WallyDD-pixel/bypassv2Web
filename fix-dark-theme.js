#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Règles de remplacement pour forcer le thème sombre
const replacements = [
  // Backgrounds
  { from: /bg-white([^/])/g, to: 'bg-slate-900$1' },
  { from: /bg-white\/(\d+)\s+dark:bg-([^\s]+)/g, to: 'bg-$2' },
  { from: /bg-white\/(\d+)/g, to: 'bg-white/$1' }, // Garder les opacités
  
  // Text colors
  { from: /text-slate-900([^/])/g, to: 'text-white$1' },
  { from: /text-slate-900\/(\d+)\s+dark:text-([^\s]+)/g, to: 'text-$2' },
  { from: /text-black([^/])/g, to: 'text-white$1' },
  
  // Borders
  { from: /border-black\/(\d+)\s+dark:border-([^\s]+)/g, to: 'border-$2' },
  { from: /border-white\/(\d+)\s+dark:border-([^\s]+)/g, to: 'border-$2' },
];

function processFile(filePath) {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    replacements.forEach(rule => {
      const newContent = content.replace(rule.from, rule.to);
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Modifié: ${filePath}`);
    }
  } catch (err) {
    console.error(`❌ Erreur avec ${filePath}:`, err.message);
  }
}

function processDirectory(dirPath) {
  const items = fs.readdirSync(dirPath);
  
  items.forEach(item => {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      processDirectory(fullPath);
    } else if (stat.isFile()) {
      processFile(fullPath);
    }
  });
}

// Traiter le dossier src
const srcPath = path.join(__dirname, 'src');
if (fs.existsSync(srcPath)) {
  console.log('🔧 Conversion vers thème sombre uniforme...');
  processDirectory(srcPath);
  console.log('✨ Conversion terminée !');
} else {
  console.error('❌ Dossier src introuvable');
}
