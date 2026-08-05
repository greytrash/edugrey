// Captura los frames de b-roll a partir del artifact servido en local.
//
//   cd <carpeta con el index.html del artifact> && python3 -m http.server 8123
//   node docs/video/capture.mjs
//
// Escribe docs/video/frames/{v,d}/<seccion>.jpg — 9:16 para reel, 16:9 para YouTube.
// El artifact es autocontenido (tipografías en base64, cero CDN), así que esto
// funciona sin conexión.

import { createRequire } from 'module';
import { mkdirSync } from 'fs';

const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const URL = process.env.CAPTURE_URL ?? 'http://127.0.0.1:8123/';
const OUT = process.env.CAPTURE_OUT ?? 'docs/video/frames';
const CHROME = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// ids reales de las secciones del artifact
const SECTIONS = ['top', 'ecosistema', 'medio', 'academia', 'estudio', 'firma', 'parte', 'manifiesto'];
const FORMATS = [['v', 1080, 1920], ['d', 1920, 1080]];

const browser = await chromium.launch({ executablePath: CHROME });

for (const [dir, width, height] of FORMATS) {
  mkdirSync(`${OUT}/${dir}`, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForTimeout(2500); // deja acabar las animaciones de entrada

  for (const id of SECTIONS) {
    const el = await page.$('#' + id);
    if (!el) { console.warn(`sin sección #${id}`); continue; }
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(700); // las secciones aparecen con IntersectionObserver
    await page.screenshot({ path: `${OUT}/${dir}/${id}.jpg`, type: 'jpeg', quality: 82 });
    console.log(`${dir}/${id}.jpg`);
  }
  await ctx.close();
}

await browser.close();
