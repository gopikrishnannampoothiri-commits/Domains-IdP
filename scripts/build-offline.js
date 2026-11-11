import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('Building project with Vite...');
execSync('npx vite build', { cwd: rootDir, stdio: 'inherit' });

const distAssetsDir = path.join(rootDir, 'dist', 'assets');
const assetFiles = fs.readdirSync(distAssetsDir);

const jsFile = assetFiles.find(f => f.endsWith('.js'));
const cssFile = assetFiles.find(f => f.endsWith('.css'));

if (!jsFile || !cssFile) {
  throw new Error(`Could not find JS (${jsFile}) or CSS (${cssFile}) in dist/assets`);
}

console.log(`Found built bundle: JS=${jsFile}, CSS=${cssFile}`);

const jsContent = fs.readFileSync(path.join(distAssetsDir, jsFile), 'utf8');
const cssContent = fs.readFileSync(path.join(distAssetsDir, cssFile), 'utf8');

// Construct offline HTML cleanly with NO string.replace on code
const offlineHtmlParts = [
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Hexnode IdP - Domain</title>
    <meta name="description" content="Enterprise Identity Provider (IdP) management console and tenant settings for Hexnode." />
    <meta property="og:title" content="Hexnode IdP - Domain" />
    <meta property="og:description" content="Enterprise Identity Provider (IdP) management console and tenant settings for Hexnode." />
    <meta property="og:type" content="website" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
`,
  cssContent,
  `
    </style>
  </head>
  <body class="bg-white font-sans text-gray-900">
    <div id="root"></div>
    <script>
`,
  jsContent,
  `
    </script>
  </body>
</html>`
];

const offlineHtml = offlineHtmlParts.join('');

const targetFiles = [
  path.join(rootDir, 'hexnode-idp-domain-offline.html'),
  path.join(rootDir, 'offline.html'),
  path.join(rootDir, 'dist', 'index.html'),
];

for (const target of targetFiles) {
  fs.writeFileSync(target, offlineHtml, 'utf8');
  console.log(`Wrote standalone offline HTML to ${target} (${(offlineHtml.length / 1024).toFixed(1)} KB)`);
}

console.log('Build completed successfully.');
