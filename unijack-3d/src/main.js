import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createUniJack } from './model.js';
import { makeStage } from './lib/stage.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const canvas = $('#c'), stageEl = $('#stage');
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

function fail(err) { $('#loader').classList.add('done'); $('#fallback').hidden = false; console.error('3D unavailable', err); }

let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
catch (e) { fail(e); throw e; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const stage = makeStage(renderer, { shadows: true });
const scene = stage.scene;
const camera = new THREE.PerspectiveCamera(32, 1, 1, 4000);
const controls = new OrbitControls(camera, canvas);
Object.assign(controls, { enableDamping: !reduce.matches, dampingFactor: 0.08, screenSpacePanning: true, minDistance: 30, maxDistance: 900, autoRotateSpeed: 0.7 });
let needs = true;
controls.addEventListener('change', () => { needs = true; });
controls.addEventListener('start', () => { setRotate(false); clearViewChips(); });

const resize = () => {
  const w = stageEl.clientWidth, h = stageEl.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); needs = true;
};
new ResizeObserver(resize).observe(stageEl); resize();

// ---------- model ----------
let kit;
try { kit = await createUniJack(); } catch (e) { fail(e); throw e; }
scene.add(kit.root);
kit.root.updateMatrixWorld(true);
const bbox = new THREE.Box3().setFromObject(kit.root);
const center = bbox.getCenter(new THREE.Vector3());
const radius = bbox.getSize(new THREE.Vector3()).length() / 2;
// bounding sphere of the fully exploded kit, so the camera can re-frame when exploding
kit.setExplode(1); kit.root.updateMatrixWorld(true);
const bboxEx = new THREE.Box3().setFromObject(kit.root);
const centerEx = bboxEx.getCenter(new THREE.Vector3()), radiusEx = bboxEx.getSize(new THREE.Vector3()).length() / 2;
kit.setExplode(0); kit.root.updateMatrixWorld(true);

// ---------- camera presets ----------
const VIEWS = { hero: { az: 32, el: 34, k: 0.8 }, top: { az: 0, el: 89, k: 0.74 }, low: { az: 18, el: 11, k: 0.86 }, side: { az: 90, el: 7, k: 0.86 }, under: { az: 28, el: -34, k: 0.86 } };
const dirFromAzEl = (az, el) => { const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el); return new THREE.Vector3(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)); };
function fitDistance(r = radius) {
  const v = THREE.MathUtils.degToRad(camera.fov), h = 2 * Math.atan(Math.tan(v / 2) * camera.aspect);
  return (r * 0.92) / Math.sin(Math.min(v, h) / 2);
}
let tween = null;
function flyTo(pos, tgt, ms = 900) {
  if (reduce.matches) { camera.position.copy(pos); controls.target.copy(tgt); controls.update(); needs = true; return; }
  const s0 = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
  const s1 = new THREE.Spherical().setFromVector3(pos.clone().sub(tgt));
  let dth = s1.theta - s0.theta; dth = Math.atan2(Math.sin(dth), Math.cos(dth));   // shortest way round
  tween = { t0: performance.now(), ms, s0, s1, dth, g0: controls.target.clone(), g1: tgt.clone() };
}
function stepTween(now) {
  if (!tween) return false;
  const k = Math.min(1, (now - tween.t0) / tween.ms), e = k * k * (3 - 2 * k), t = tween;
  controls.target.lerpVectors(t.g0, t.g1, e);
  const s = new THREE.Spherical(THREE.MathUtils.lerp(t.s0.radius, t.s1.radius, e), THREE.MathUtils.lerp(t.s0.phi, t.s1.phi, e), t.s0.theta + t.dth * e);
  camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));
  if (k >= 1) tween = null;
  return true;
}
function flyToView(name) {
  const v = VIEWS[name]; if (!v) return;
  setRotate(false);
  flyTo(center.clone().add(dirFromAzEl(v.az, v.el).multiplyScalar(fitDistance() * v.k)), center);
  $$('[data-view]').forEach((b) => { const on = b.dataset.view === name; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
}
function clearViewChips() { $$('[data-view]').forEach((b) => { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); }); }
{ const v = VIEWS.hero, d = fitDistance() * v.k; camera.position.copy(center).add(dirFromAzEl(v.az, v.el).multiplyScalar(d)); controls.target.copy(center); controls.update(); }
$$('[data-view]').forEach((b) => b.addEventListener('click', () => flyToView(b.dataset.view)));

// ---------- auto-rotate ----------
function setRotate(on) {
  controls.autoRotate = on && !reduce.matches;
  const b = $('#btn-rotate'); b.setAttribute('aria-pressed', String(controls.autoRotate));
  b.setAttribute('aria-label', controls.autoRotate ? 'Pause automatic rotation' : 'Start automatic rotation'); needs = true;
}
$('#btn-rotate').addEventListener('click', () => setRotate(!controls.autoRotate));
setRotate(!reduce.matches);

// ---------- keyboard ----------
canvas.addEventListener('keydown', (e) => {
  const step = THREE.MathUtils.degToRad(e.shiftKey ? 2 : 8);
  const off = camera.position.clone().sub(controls.target), s = new THREE.Spherical().setFromVector3(off);
  let used = true;
  switch (e.key) {
    case 'ArrowLeft': s.theta -= step; break; case 'ArrowRight': s.theta += step; break;
    case 'ArrowUp': s.phi = Math.max(0.05, s.phi - step); break; case 'ArrowDown': s.phi = Math.min(Math.PI - 0.05, s.phi + step); break;
    case '+': case '=': s.radius = Math.max(controls.minDistance, s.radius * 0.88); break;
    case '-': case '_': s.radius = Math.min(controls.maxDistance, s.radius / 0.88); break;
    case 'Escape': select(null); used = false; break;
    default: used = false;
  }
  if (used) { e.preventDefault(); setRotate(false); clearViewChips(); camera.position.copy(controls.target).add(off.setFromSpherical(s)); controls.update(); needs = true; }
});

// ---------- visibility / insertion / explode ----------
const show = { base: true, mercury: true, peri: true };
$$('[data-show]').forEach((b) => b.addEventListener('click', () => {
  const k = b.dataset.show; show[k] = !show[k]; b.classList.toggle('on', show[k]); b.setAttribute('aria-pressed', String(show[k]));
  kit.setVisible(show); refreshAnchors(); needs = true;
}));
const ins = $('#ins'), insOut = $('#ins-out');
const insText = (t) => (t >= 0.999 ? 'Seated, latches closed' : t <= 0.001 ? 'Separated' : t < 0.62 ? 'Sliding in at an angle' : 'Pressing down');
function setIns(t) { kit.setInsertion(t); ins.value = Math.round(t * 100); insOut.textContent = insText(t); refreshAnchors(); needs = true; }
let play = null;
ins.addEventListener('input', () => { play = null; setIns(ins.value / 100); });
$('#btn-play').addEventListener('click', () => {
  if (reduce.matches) { setIns(kit.state.insertion > 0.5 ? 0 : 1); return; }
  expAnim = null; setExpl(0);
  const m = new THREE.Vector3(); kit.mercury.getWorldPosition(m);
  const tgt = new THREE.Vector3(m.x - 6, 6, m.z);
  setRotate(false); clearViewChips();
  flyTo(tgt.clone().add(dirFromAzEl(72, 16).multiplyScalar(fitDistance(radius * 0.62))), tgt, 900);
  setIns(0); play = { t0: performance.now() + 700, ms: 3800 };
});
function stepPlay(now) {
  if (!play) return false;
  const k = Math.min(1, Math.max(0, (now - play.t0) / play.ms)); setIns(k); if (k >= 1) play = null; return true;
}
const expIn = $('#exp'), expOut = $('#exp-out'), expBtn = $('#btn-explode');
let expAnim = null;
function setExpl(v) {
  kit.setExplode(v); expIn.value = Math.round(v * 100); expOut.textContent = Math.round(v * 100) + '%';
  expBtn.setAttribute('aria-pressed', String(v >= 0.5)); refreshAnchors(); needs = true;
}
function frameForExplode(t) {
  const on = t > 0.5, tgt = on ? centerEx : center, r = on ? radiusEx : radius;
  const dir = camera.position.clone().sub(controls.target).normalize();
  if (on && dir.y < 0.35) { dir.y = 0.42; dir.normalize(); }          // need some elevation to see the separation
  clearViewChips(); flyTo(tgt.clone().add(dir.multiplyScalar(fitDistance(r))), tgt, 1200);
}
function explodeTo(t) {
  play = null; frameForExplode(t);
  if (reduce.matches) { setExpl(t); return; }
  expAnim = { t0: performance.now(), ms: 1200, from: kit.state.explode, to: t };
}
function stepExplode(now) {
  if (!expAnim) return false;
  const k = Math.min(1, (now - expAnim.t0) / (expAnim.ms)); setExpl(expAnim.from + (expAnim.to - expAnim.from) * k);
  if (k >= 1) expAnim = null; return true;
}
expBtn.addEventListener('click', () => explodeTo((expAnim ? expAnim.to : kit.state.explode) > 0.5 ? 0 : 1));   // rotation keeps running while exploded
expIn.addEventListener('input', () => { expAnim = null; setExpl(expIn.value / 100); });

// ---------- selection + inspector ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let sel = null, helper = null; const selBox = new THREE.Box3();
const visibleDeep = (o) => { while (o) { if (!o.visible) return false; o = o.parent; } return true; };
let down = null;
canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener('pointerup', (e) => {
  if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && performance.now() - down.t < 500) {
    const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(kit.root, true).find((h) => visibleDeep(h.object) && kit.infoFor(h.object));
    select(hit ? kit.infoFor(hit.object) : null);
  }
  down = null;
});
const STATUS = { 'photo-verified': 'photo-verified', 'photo-derived': 'photo-derived', assumed: 'assumed' };
function showCard(obj) {
  const c = $('#card'); c.replaceChildren();
  if (!obj) { c.hidden = true; return; }
  const u = obj.userData, b = new THREE.Box3().setFromObject(obj), s = b.getSize(new THREE.Vector3());
  const x = el('button', 'x', '×'); x.setAttribute('aria-label', 'Close part info'); x.onclick = () => select(null);
  const h = el('h2'); if (u.ref) h.append(el('span', 'ref', u.ref)); h.append(el('span', null, u.label)); h.append(el('span', 'st ' + (u.status || 'assumed'), STATUS[u.status] || 'assumed'));
  c.append(x, h);
  if (u.desc) c.append(el('p', null, u.desc));
  c.append(el('p', 'dim', `About ${s.x.toFixed(1)} × ${s.z.toFixed(1)} mm footprint, ${s.y.toFixed(1)} mm tall (bounding box; heights are assumed unless stated).`));
  c.hidden = false;
}
function select(obj) {
  sel = obj;
  if (helper) { scene.remove(helper); helper.geometry.dispose(); helper = null; }
  if (obj) { selBox.setFromObject(obj); helper = new THREE.Box3Helper(selBox, 0x74e2f4); helper.material.depthTest = false; helper.renderOrder = 10; scene.add(helper); }
  showCard(obj); markList(obj); needs = true;
}
function focusOn(obj) {
  const b = new THREE.Box3().setFromObject(obj), c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3());
  const d = Math.min(controls.maxDistance, Math.max(controls.minDistance, fitDistance(Math.max(sz.x, sz.y, sz.z) * 0.9 + 6)));
  const dir = camera.position.clone().sub(controls.target).normalize(); dir.y = Math.max(dir.y, 0.55); dir.normalize();
  setRotate(false); clearViewChips(); flyTo(c.clone().add(dir.multiplyScalar(d)), c, 800);
}

// ---------- parts list ----------
const boardOf = (o) => { for (let n = o; n; n = n.parent) { if (n === kit.base) return 'base'; if (n === kit.mercury) return 'mercury'; if (n === kit.peri) return 'peri'; } return 'base'; };
const GROUPS = { base: 'UniJack base board', mercury: 'Mercury module', peri: 'PeriBoard' };
const listBtns = new Map();
function buildList() {
  const list = $('#part-list'); list.replaceChildren(); listBtns.clear();
  const by = { base: [], mercury: [], peri: [] };
  for (const o of kit.parts) by[boardOf(o)].push(o);
  for (const k of Object.keys(by)) {
    if (!by[k].length) continue;
    by[k].sort((a, b) => (!!b.userData.ref - !!a.userData.ref) || (a.userData.ref || '').localeCompare(b.userData.ref || '', undefined, { numeric: true }) || a.userData.label.localeCompare(b.userData.label));   // designators first
    list.append(el('h3', null, `${GROUPS[k]} (${by[k].length})`));
    for (const o of by[k]) {
      const b = el('button'); b.dataset.q = `${o.userData.ref || ''} ${o.userData.label}`.toLowerCase();
      b.append(el('span', 'r', o.userData.ref || ''), el('span', null, o.userData.label));
      b.onclick = () => { select(o); focusOn(o); };
      list.append(b); listBtns.set(o, b);
    }
  }
}
function markList(obj) { for (const [o, b] of listBtns) b.classList.toggle('sel', o === obj); }
buildList();
$('#part-filter').addEventListener('input', (e) => { const q = e.target.value.trim().toLowerCase(); for (const b of listBtns.values()) b.hidden = q && !b.dataset.q.includes(q); });
const setPanel = (open) => { $('#parts-panel').hidden = !open; $('#btn-parts').setAttribute('aria-expanded', String(open)); };
$('#btn-parts').addEventListener('click', () => setPanel($('#parts-panel').hidden));
$('#parts-close').addEventListener('click', () => setPanel(false));

// ---------- designator labels ----------
const labelHost = $('#labels'); let labelsOn = false; const labels = [];
for (const o of kit.parts.filter((p) => p.userData.ref)) { const d = el('div', 'tag', o.userData.ref); d.hidden = true; labelHost.append(d); labels.push({ o, d, p: new THREE.Vector3() }); }
const boardTags = [['base', 'UniJack base board'], ['mercury', 'Mercury module'], ['peri', 'PeriBoard']].map(([k, text]) => {
  const d = el('div', 'tag board', text); d.hidden = true; labelHost.append(d);
  return { obj: k === 'base' ? kit.base : k === 'mercury' ? kit.mercury : kit.peri, k, d, p: new THREE.Vector3() };
});
function refreshAnchors() {
  kit.root.updateMatrixWorld(true); const b = new THREE.Box3();
  if (labelsOn) for (const L of labels) { b.setFromObject(L.o); b.getCenter(L.p); L.p.y = b.max.y + 0.4; }
  if (kit.state.explode > 0.02) for (const T of boardTags) {
    b.setFromObject(T.obj); b.getCenter(T.p);
    if (T.k === 'base') { T.p.y = b.max.y; T.p.z = b.max.z + 7; } else T.p.y = b.max.y + 6;
  }
}
function updateLabels() {
  const w = stageEl.clientWidth, h = stageEl.clientHeight, v = new THREE.Vector3(), e = kit.state.explode;
  if (labelsOn) for (const L of labels) {
    v.copy(L.p).project(camera);
    const vis = visibleDeep(L.o) && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
    L.d.hidden = !vis; if (vis) L.d.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px,${(-v.y * 0.5 + 0.5) * h}px) translate(-50%,-50%)`;
  }
  for (const T of boardTags) {
    v.copy(T.p).project(camera);
    const vis = e > 0.35 && visibleDeep(T.obj) && v.z < 1;
    T.d.hidden = !vis; if (vis) { T.d.style.opacity = String(Math.min(1, (e - 0.35) / 0.4)); T.d.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px,${(-v.y * 0.5 + 0.5) * h}px) translate(-50%,-50%)`; }
  }
}
$('#btn-labels').addEventListener('click', (e) => {
  labelsOn = !labelsOn; e.currentTarget.setAttribute('aria-pressed', String(labelsOn));
  if (!labelsOn) labels.forEach((L) => { L.d.hidden = true; });
  refreshAnchors(); needs = true;
});
if (!labels.length) $('#btn-labels').hidden = true;

// ---------- loop (renders only when something changed) ----------
let firstFrame = true;
function loop(now) {
  requestAnimationFrame(loop);
  const moving = stepTween(now) | stepPlay(now) | stepExplode(now);
  const camMoved = controls.update();
  if (!(camMoved || moving || needs)) return;
  if (helper && sel) selBox.setFromObject(sel);
  renderer.render(scene, camera); updateLabels(); needs = false;
  if (firstFrame) { firstFrame = false; $('#loader').classList.add('done'); window.__viewerReady = true; }
}
requestAnimationFrame(loop);
window.__unijack = { kit, camera, controls, select, flyToView, explodeTo, THREE };
