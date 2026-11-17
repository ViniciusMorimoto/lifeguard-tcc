// Render the exact vector paths used in the app for visual inspection.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
const sharp = require(process.argv[2] || 'sharp');
const source = fs.readFileSync(path.join(__dirname, '../src/components/lifeGuardIconPaths.ts'), 'utf8');
const context = { exports: {} };
vm.runInNewContext(ts.transpile(source, { module: ts.ModuleKind.CommonJS }), context);
const entries = Object.entries(context.exports.lifeGuardIconPaths);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="840" height="160">
<rect width="840" height="160" fill="#F2F5F7"/>${entries.map(([name, paths], i) =>
  `<g transform="translate(${i * 120 + 30} 30) scale(2.5)" fill="none" stroke="#1976A8" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths.map(d => `<path d="${d}"/>`).join('')}</g><text x="${i * 120 + 60}" y="130" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#123B5D">${name}</text>`
).join('')}</svg>`;
fs.mkdirSync(path.join(__dirname, '../tmp/brand-review'), { recursive: true });
sharp(Buffer.from(svg)).png().toFile(path.join(__dirname, '../tmp/brand-review/custom-icons.png'));
