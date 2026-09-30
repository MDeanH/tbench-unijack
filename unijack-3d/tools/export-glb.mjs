#!/usr/bin/env node
// Export the assembled kit to assets/unijack.glb (headless, software WebGL not needed for export but harmless).
//   node tools/export-glb.mjs [--out=assets/unijack.glb]
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const OUT = path.resolve(ROOT, args.out || 'assets/unijack.glb');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/favicon')) { res.writeHead(204); return res.end(); }
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const exe = (() => { const b = '/opt/pw-browsers'; for (const d of fs.existsSync(b) ? fs.readdirSync(b) : []) { const c = path.join(b, d, 'chrome-linux', 'chrome'); if (d.startsWith('chromium-') && fs.existsSync(c)) return c; } })();
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
try {
  const page = await browser.newPage(); const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/export.html`);
  await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 240000 });
  const err = await page.evaluate(() => window.__error); if (err) throw new Error(err);
  const b64 = await page.evaluate(() => window.__glb);
  const buf = Buffer.from(b64, 'base64'); fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, buf);
  // validate: parse the JSON chunk
  const jlen = buf.readUInt32LE(12), json = JSON.parse(buf.subarray(20, 20 + jlen).toString());
  const named = (json.nodes || []).filter((n) => n.name).length, withExtras = (json.nodes || []).filter((n) => n.extras && n.extras.label).length;
  console.log(`${OUT}  ${(buf.length / 1048576).toFixed(2)} MB  nodes=${json.nodes?.length} named=${named} withLabel=${withExtras} meshes=${json.meshes?.length} materials=${json.materials?.length} textures=${json.textures?.length} ext=${(json.extensionsUsed || []).join(',')}`);
  if (errs.length) console.log('console errors:', errs.slice(0, 3));
} catch (e) { console.error('export failed:', e.message); process.exitCode = 1; }
finally { await browser.close(); server.close(); }
