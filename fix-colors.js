#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Corrections spécifiques pour éviter blanc sur blanc
const fixes = [
  // Texte blanc sur fond blanc -> texte slate sur fond blanc
  { from: /text-white([^/\s]*)\s+bg-white/g, to: 'text-slate-900$1 bg-white' },
  
  // Supprimer les variantes dark: restantes 
  { from: /\s+dark:[^\s]+/g, to: '' },
  
  // Corrections spécifiques pour les éléments problématiques
  { from: /bg-white\/5\s+border-white\/40\s+dark:border-white\/15\s+text-white/g, to: 'bg-white/5 border-white/15 text-white' },
  
  // Texte slate-900 sur fond sombre -> texte blanc
  { from: /text-slate-900([^/\s]*)\s+bg-(slate-900|white\/5|white\/10)/g, to: 'text-white bg-$2' },
  
  // Border noir sur fond sombre -> border blanc
  { from: /border-black\/(\d+)/g, to: 'border-white/15' },
];

function fixFile(filePath) {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    fixes.forEach(fix => {
      const newContent = content.replace(fix.from, fix.to);
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Corrigé: ${path.basename(filePath)}`);
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
      fixFile(fullPath);
    }
  });
}

// Traiter le dossier src
const srcPath = path.join(__dirname, 'src');
if (fs.existsSync(srcPath)) {
  console.log('🔧 Correction des couleurs blanc sur blanc...');
  processDirectory(srcPath);
  console.log('✨ Correction terminée !');
} else {
  console.error('❌ Dossier src introuvable');
}
