import fs from 'fs';
import path from 'path';
import { updateGraphWithExtraction } from './processor.mjs';

const VAULT_PATHS = [
  '/home/node/.openclaw/workspace/obsidian_vault',
  '/home/node/.openclaw/workspace/obsidian_TylerVaultSync'
];

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      arrayOfFiles.push(path.join(dirPath, "/", file));
    }
  });

  return arrayOfFiles;
}

function extractLinks(content) {
  const links = [];
  const regex = /\[\[(.*?)\]\]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    // Handle aliases [[Note Name|Alias]]
    const linkText = match[1].split('|')[0];
    links.push(linkText);
  }
  return links;
}

export function scanObsidian() {
  const nodes = [];
  const edges = [];
  
  VAULT_PATHS.forEach(vaultPath => {
    if (!fs.existsSync(vaultPath)) return;
    
    const files = getAllFiles(vaultPath).filter(f => f.endsWith('.md'));
    
    files.forEach(filePath => {
      const fileName = path.basename(filePath, '.md');
      const content = fs.readFileSync(filePath, 'utf8');
      const links = extractLinks(content);
      
      nodes.push({
        id: fileName,
        type: 'Note',
        properties: { path: filePath }
      });
      
      links.forEach(link => {
        edges.push({
          source: fileName,
          target: link,
          relation: 'links_to'
        });
      });
    });
  });
  
  return updateGraphWithExtraction({ nodes, edges });
}

if (process.argv[1].endsWith('obsidian_scanner.mjs')) {
  console.log('Scanning unified Obsidian vault...');
  const stats = scanObsidian();
  console.log(`Scan complete: Added ${stats.nodesAdded} new notes and ${stats.edgesAdded} new connections.`);
}
