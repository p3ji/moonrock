import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const catalog = JSON.parse(readFileSync(path.join(root, 'src/catalog.json'), 'utf8'));
const htmlEscape = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

function renderItems(items, coffee = false) {
  return items.map((item) => {
    const options = (item.options || []).map((option) => htmlEscape(option.en)).join(' / ');
    return `<li class="${coffee ? 'coffee-card' : 'drink-item'}"><div class="item-name">${htmlEscape(item.en)}</div>${options ? `<div class="choices">${options}</div>` : ''}</li>`;
  }).join('');
}

function renderFoodSection(section, index) {
  const items = section.items.map((item) => {
    const options = (item.options || []).map((option) => htmlEscape(option.en)).join(' / ');
    return `<li class="menu-item"><div class="item-name">${htmlEscape(item.en)}</div>${options ? `<div class="choices">${options}</div>` : ''}</li>`;
  }).join('');
  return `<section class="menu-section"><header class="section-head"><span class="section-number">0${index + 1}</span><h2>${htmlEscape(section.title)}</h2><img class="section-orbit" src="../assets/section-sparkle.svg" alt=""></header><ul class="menu-list">${items}</ul></section>`;
}

const appetizers = catalog.sections.find((section) => section.id === 'appetizers');
const mains = catalog.sections.find((section) => section.id === 'mains');
const desserts = catalog.sections.find((section) => section.id === 'desserts');
const drinks = catalog.sections.find((section) => section.id === 'drinks');
if (![appetizers, mains, desserts, drinks].every(Boolean)) throw new Error('Expected four menu sections in src/catalog.json');

const juice = drinks.items.find((item) => item.id === 'drinks-1');
const softDrinks = drinks.items.find((item) => item.id === 'drinks-2');
const smoothie = drinks.items.find((item) => item.id === 'drinks-4');
const tea = drinks.items.find((item) => item.id === 'drinks-6');
const coffee = drinks.items.find((item) => item.id === 'drinks-7');
if (![juice, softDrinks, smoothie, tea, coffee].every(Boolean)) throw new Error('Expected current drinks in src/catalog.json');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Moonrock, the menu for Theo’s 13th birthday."><title>Moonrock — Theo’s 13th Birthday Menu</title><link rel="icon" href="../assets/emblem.svg" type="image/svg+xml"><link rel="stylesheet" href="staples-letter-portrait.css"></head>
<body><div class="toolbar"><span>US Letter · portrait · double-sided · flip on long edge</span><button type="button" onclick="window.print()">Print / save PDF</button></div><main>
<article class="sheet food-side" aria-label="Food menu, front">
  <div class="hero"><p class="star-dot one"></p><p class="star-dot two"></p><p class="star-dot three"></p><div class="hero-copy"><p class="eyebrow">THEO’S 13TH BIRTHDAY</p><h1>Moonrock<span>.</span></h1><p class="descriptor">The menu</p></div><img class="hero-art" src="../assets/storybook.webp" alt="Silver fox resting on a crescent moon"><img class="hero-mark" src="../assets/emblem.svg" alt=""></div>
  <div class="section-label"><span>From the kitchen</span><span>01 — 03</span></div>
  <div class="food-grid">${[appetizers, mains, desserts].map((section, index) => renderFoodSection(section, index)).join('')}</div>
  <footer class="front-footer"><span class="brand-mini">MOONROCK</span><span>GOOD FOOD · FAMILIAR FACES</span><span>01 / 02</span></footer>
</article>
<article class="sheet drinks-side" aria-label="Drinks menu, reverse">
  <div class="hero drinks-hero"><p class="star-dot one"></p><p class="star-dot two"></p><p class="star-dot three"></p><div class="hero-copy"><p class="eyebrow">THEO’S 13TH BIRTHDAY</p><h1>Drinks<span>.</span></h1><p class="descriptor">The menu</p></div><img class="hero-art" src="../assets/moonrock.webp" alt="Textured moonrock asteroid"><img class="hero-mark" src="../assets/emblem.svg" alt=""></div>
  <div class="drinks-body"><section class="drink-column all-drinks" aria-label="Drinks menu"><ul class="menu-list">${renderItems([juice, softDrinks, smoothie, tea])}${renderItems([coffee], true)}</ul><div class="qr-card"><img src="../assets/qr.svg" alt="QR code for cafe.peji.ca"><div><p class="qr-label">Order at your table</p><p class="qr-title">Scan to order</p><p class="qr-url">cafe.peji.ca</p><p class="qr-desc">Send orders straight to the kitchen.</p></div></div></section></div>
  <footer class="back-footer"><span class="brand-mini">MOONROCK</span><span class="center-note">Make yourself at home.</span><span>02 / 02</span></footer>
</article>
</main></body></html>`;

const htmlPath = path.join(root, 'print/staples-letter-portrait.html');
const pdfPath = path.join(root, 'output/pdf/moonrock-staples-letter-portrait.pdf');
writeFileSync(htmlPath, html);
mkdirSync(path.dirname(pdfPath), { recursive: true });

const require = createRequire(import.meta.url);
const playwrightPath = process.env.PLAYWRIGHT_MODULE || '/Users/pushp/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const { chromium } = require(playwrightPath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || '/Users/pushp/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell',
});
const page = await browser.newPage({ viewport: { width: 816, height: 1056 }, deviceScaleFactor: 1 });
await page.goto(new URL('../print/staples-letter-portrait.html', import.meta.url).href);
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: pdfPath, printBackground: true, preferCSSPageSize: true, tagged: true });
await browser.close();
console.log('Rendered print/staples-letter-portrait.html and output/pdf/moonrock-staples-letter-portrait.pdf');
