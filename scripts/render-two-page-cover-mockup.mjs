import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourcePath = path.join(root, 'print/staples-single-side.html');
const htmlPath = path.join(root, 'print/staples-two-page-mockup.html');
const pdfPath = path.join(root, 'output/pdf/moonrock-two-page-cover-mockup.pdf');
const source = readFileSync(sourcePath, 'utf8');
const pageBreak = `</article></main>`;
if (!source.includes(pageBreak)) throw new Error('Could not find the menu page closing tag');
const cover = `</article><article class="sheet back-cover"><div class="cover-lockup"><img src="../assets/fox-moon-gold-outline.png" alt="Gold line illustration of a sleeping fox curled on the moon"></div></article></main>`;
const html = source
  .replace('</head>', '<link rel="stylesheet" href="staples-cover.css"></head>')
  .replace(pageBreak, cover);
writeFileSync(htmlPath, html);
mkdirSync(path.dirname(pdfPath), { recursive: true });

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/Users/pushp/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/Users/pushp/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell' });
const page = await browser.newPage({ viewport: { width: 816, height: 1056 } });
await page.goto(new URL('../print/staples-two-page-mockup.html', import.meta.url).href);
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: pdfPath, printBackground: true, preferCSSPageSize: true, tagged: true });
await browser.close();
console.log('Rendered print/staples-two-page-mockup.html and output/pdf/moonrock-two-page-cover-mockup.pdf');
