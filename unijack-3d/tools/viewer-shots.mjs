#!/usr/bin/env node
// End-to-end viewer check (software WebGL). Loads index.html, drives the UI like a user, saves screenshots and reports
// console errors, horizontal overflow and the state of key controls.   node tools/viewer-shots.mjs [--dir=qa-out/viewer]
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const OUT = path.resolve(ROOT, args.dir || 'qa-out/viewer');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.css': 'text/css', '.glb': 'model/gltf-binary' };
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/favicon')) { res.writeHead(204); return res.end(); }
  let p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)); if (p.endsWith('/')) p += 'index.html';
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const exe = (() => { const b = '/opt/pw-browsers'; for (const d of fs.existsSync(b) ? fs.readdirSync(b) : []) { const c = path.join(b, d, 'chrome-linux', 'chrome'); if (d.startsWith('chromium-') && fs.existsSync(c)) return c; } })();
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
fs.mkdirSync(OUT, { recursive: true });
const report = [];

async function session(name, ctxOpts, script) {
  const ctx = await browser.newContext(ctxOpts); const page = await ctx.newPage(); const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 240)); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 240)));
  await page.goto(base + 'index.html'); await page.waitForFunction(() => window.__viewerReady, null, { timeout: 180000 });
  const shot = async (n) => page.screenshot({ path: path.join(OUT, `${name}-${n}.png`) });
  await script(page, shot);
  const overflow = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  report.push({ name, errors: errs, overflow });
  await ctx.close();
}

const flow = async (page, shot) => {
  await page.evaluate(() => { window.__unijack.controls.autoRotate = false; });   // deterministic frames
  await page.waitForTimeout(1200); await shot('1-hero');
  await page.click('#btn-explode'); await page.waitForTimeout(3200); await shot('2-exploded');
  report.push({ check: 'explode pressed', v: await page.getAttribute('#btn-explode', 'aria-pressed'), slider: await page.inputValue('#exp'), state: await page.evaluate(() => window.__unijack.kit.state) });
  await page.click('#btn-explode'); await page.waitForTimeout(3200);
  report.push({ check: 'un-explode', slider: await page.inputValue('#exp') });
  await page.evaluate(() => { const i = document.querySelector('#ins'); i.value = 40; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(800); await shot('3-insertion-40');
  await page.evaluate(() => { const i = document.querySelector('#ins'); i.value = 100; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.click('#btn-parts'); await page.waitForTimeout(600);
  report.push({ check: 'parts listed', n: await page.$$eval('#part-list button', (b) => b.length) });
  await page.evaluate(() => { const u = window.__unijack; const p = u.kit.parts.find((x) => x.userData.ref) || u.kit.parts[0]; if (p) u.select(p); });
  await page.waitForTimeout(600); await shot('4-parts-selected');
  await page.click('#btn-labels').catch(() => {}); await page.waitForTimeout(600); await shot('5-labels');
  await page.click('[data-view="under"]'); await page.waitForTimeout(1800); await shot('6-underside');
};
await session('desktop', { viewport: { width: 1440, height: 900 } }, flow);
await session('mobile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, async (page, shot) => {
  await page.evaluate(() => { window.__unijack.controls.autoRotate = false; }); await page.waitForTimeout(1200); await shot('1-hero');
  await page.click('#btn-explode'); await page.waitForTimeout(3200); await shot('2-exploded');
});
console.log(JSON.stringify(report, null, 1));
await browser.close(); server.close();
