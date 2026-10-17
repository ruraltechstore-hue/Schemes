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

const routesDir = path.resolve('./src/routes');
const files = walkDir(routesDir);

files.forEach(file => {
    if (!file.endsWith('.tsx') && !file.endsWith('.ts')) return;
    
    let content = fs.readFileSync(file, 'utf8');
    
    // Remove tanstack imports
    content = content.replace(/import {[^}]*createFileRoute[^}]*} from "@tanstack\/react-router";\r?\n?/g, '');
    content = content.replace(/import {([^}]*)} from "@tanstack\/react-router";/g, (match, p1) => {
        const filtered = p1.split(',').map(s => s.trim()).filter(s => s !== 'createFileRoute' && s !== 'redirect').join(', ');
        return filtered ? `import { ${filtered} } from "react-router-dom";` : '';
    });
    content = content.replace(/throw redirect\(\{\s*to:\s*("[^"]+")\s*\}\)/g, 'return window.location.href = $1');

    // Replace createFileRoute boilerplates with export default Component
    content = content.replace(/export const Route = createFileRoute\([^)]+\)\(\{\s*head:[\s\S]*?component: ([a-zA-Z0-9_]+),?\s*\}\);/g, 'export default $1;');
    content = content.replace(/export const Route = createFileRoute\([^)]+\)\(\{\s*ssr:[\s\S]*?component: ([a-zA-Z0-9_]+),?\s*\}\);/g, 'export default $1;');
    content = content.replace(/export const Route = createFileRoute\([^)]+\)\(\{\s*component: ([a-zA-Z0-9_]+),?\s*\}\);/g, 'export default $1;');

    // Rename hook for params
    content = content.replace(/Route\.useParams\(\)/g, 'useParams()');

    fs.writeFileSync(file, content);
});

console.log('Routes refactored');
