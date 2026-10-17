import fs from 'fs';
import path from 'path';

function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walkDir(file));
        } else { 
            results.push(file);
        }
    });
    return results;
}

const files = walkDir(path.resolve('./src/routes'));

files.forEach(file => {
    if (!file.endsWith('.tsx') && !file.endsWith('.ts')) return;
    
    let content = fs.readFileSync(file, 'utf8');
    
    let needsLink = /\bLink\b/.test(content);
    let needsNavigate = /\buseNavigate\b/.test(content);
    let needsParams = /\buseParams\b/.test(content);
    let needsOutlet = /\bOutlet\b/.test(content);

    // If react-router-dom is already imported, find what's missing
    const rrdMatch = content.match(/import\s+{([^}]+)}\s+from\s+["']react-router-dom["']/);
    let existingImports = [];
    if (rrdMatch) {
      existingImports = rrdMatch[1].split(',').map(s => s.trim());
      if (existingImports.includes('Link')) needsLink = false;
      if (existingImports.includes('useNavigate')) needsNavigate = false;
      if (existingImports.includes('useParams')) needsParams = false;
      if (existingImports.includes('Outlet')) needsOutlet = false;
    }

    const toAdd = [];
    if (needsLink) toAdd.push('Link');
    if (needsNavigate) toAdd.push('useNavigate');
    if (needsParams) toAdd.push('useParams');
    if (needsOutlet) toAdd.push('Outlet');

    if (toAdd.length > 0) {
      if (rrdMatch) {
        content = content.replace(rrdMatch[0], `import { ${[...existingImports, ...toAdd].join(', ')} } from "react-router-dom"`);
      } else {
        content = `import { ${toAdd.join(', ')} } from "react-router-dom";\n` + content;
      }
    }

    // Fix activeProps in route.tsx
    content = content.replace(/activeProps=\{[^}]+\}/g, '');
    
    // Fix navigate({ to: "..." })
    content = content.replace(/navigate\(\{\s*to:\s*("[^"]+")[^}]*replace:\s*(true|false)[^}]*\}\)/g, 'navigate($1, { replace: $2 })');
    content = content.replace(/navigate\(\{\s*to:\s*("[^"]+")[^}]*\}\)/g, 'navigate($1)');

    fs.writeFileSync(file, content);
});

console.log('Imports fixed');
