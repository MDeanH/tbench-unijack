// QA renderer page. Driven by tools/qa-render.mjs via query string:
//   only=all|base|peri|mercury   view=top|bottom|oblique|custom   mode=photo|footprint|clay
//   az, el (degrees, oblique)    ins, exp (0..1 model state)       w, h (px; top/bottom default to the texture size)
//   cam=x,y,z,tx,ty,tz (custom)  fov
//   post=0|1 (EffectComposer: GTAO + SMAA + OutputPass; default ON for oblique/custom photo renders, OFF for top/bottom/footprint/clay)
//   dof=1 (depth of field, needs post)   env=studio|room   shadow=pcf|vsm   ao=0 (post without AO)
import * as THREE from 'three';
import { createUniJack } from './model.js';
import { makeStage } from './lib/stage.js';
import { makePost } from './lib/post.js';

const q = new URLSearchParams(location.search);
const only = q.get('only') || 'all', view = q.get('view') || 'oblique', mode = q.get('mode') || 'photo';
const num = (k, d) => (q.has(k) ? parseFloat(q.get(k)) : d);

const KIND_COLOR = { connector: 0xff3b30, ic: 0x34c759, passive: 0xffcc00, cap: 0xff9500, pin: 0xaf52de, latch: 0x5ac8fa, led: 0xff2d92, module: 0x0a84ff, other: 0xffffff };

globalThis.__PHOTO_GAIN = q.has('gain') ? parseFloat(q.get('gain')) : undefined;   // calibration sweeps
globalThis.__PHOTO_ENV = q.has('env') ? parseFloat(q.get('env')) : undefined;
(async () => {
  try {
    const rectify = q.has('rectify') ? q.get('rectify') === '1' : !(mode === 'footprint' || view === 'top' || view === 'bottom');   // overlays compare against UNrectified textures
    const kit = await createUniJack({ rectify });
    const fr = kit.ctx.frames;
    const frame = only === 'base' ? fr.base : only === 'peri' ? fr.peri : only === 'mercury' ? fr.mercuryFront : null;
    let W = num('w', 0), H = num('h', 0);
    if ((view === 'top' || view === 'bottom') && frame && !W) { W = frame.wpx; H = frame.hpx; }
    W = W || 1600; H = H || 900;

    const canvas = document.createElement('canvas'); document.body.appendChild(canvas);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1); renderer.setSize(W, H, false);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';

    const footprint = mode === 'footprint';
    const stage = makeStage(renderer, { shadows: !footprint, env: q.get('env') || 'studio', shadowType: q.get('shadow') || 'pcf' });
    const wantPost = q.has('post') ? q.get('post') === '1' : (mode === 'photo' && (view === 'oblique' || view === 'custom'));
    kit.setVisible({ base: only === 'all' || only === 'base', peri: only === 'all' || only === 'peri', mercury: only === 'all' || only === 'mercury' });
    kit.setInsertion(num('ins', 1)); kit.setExplode(num('exp', 0));
    for (const n of (q.get('hide') || '').split(',').filter(Boolean)) { const o = kit.root.getObjectByName(n); if (o) o.visible = false; else console.warn('hide: no object named', n); }
    if (kit.base.userData.buildErrors?.length) console.error('BUILD ERRORS: ' + kit.base.userData.buildErrors.join(' ; '));
    stage.scene.add(kit.root);

    if (footprint) {
      renderer.toneMapping = THREE.NoToneMapping; stage.scene.background = new THREE.Color(0x000000);
      stage.scene.environment = null; stage.ground.visible = false; if (stage.backdrop) stage.backdrop.visible = false; stage.scene.fog = null;
      stage.scene.traverse((o) => {
        if (!(o.isMesh || o.isInstancedMesh)) return;
        let k = null, n = o; while (n && !k) { k = n.userData?.kind; n = n.parent; }
        const col = k === 'board' ? 0x000000 : (KIND_COLOR[k] ?? KIND_COLOR.other);
        o.material = new THREE.MeshBasicMaterial({ color: col });
      });
    } else if (mode === 'clay') {
      stage.scene.traverse((o) => { if ((o.isMesh || o.isInstancedMesh) && o.name !== 'ground' && o.name !== 'backdrop') o.material = new THREE.MeshStandardMaterial({ color: 0xb8c0c8, roughness: 0.7 }); });
    }

    // camera
    kit.root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    kit.root.traverseVisible((o) => { if ((o.isMesh || o.isInstancedMesh) && o.name !== 'ground') box.expandByObject(o); });
    const ctr = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    let cam;
    if (view === 'top' || view === 'bottom') {
      // exact orthographic frame of the board's texture so the render overlays the photo 1:1
      const target = new THREE.Vector3(); (only === 'base' ? kit.base : only === 'peri' ? kit.peri : kit.mercury).getWorldPosition(target);
      const hw = frame ? frame.W / 2 : size.x / 2, hd = frame ? frame.D / 2 : size.z / 2;
      cam = new THREE.OrthographicCamera(-hw, hw, hd, -hd, 0.1, 1000);
      cam.up.set(0, 0, -1);
      const dir = view === 'top' ? 1 : -1;
      cam.position.set(target.x, target.y + dir * 300, target.z); cam.lookAt(target.x, target.y, target.z);
    } else {
      const fov = num('fov', 30);
      cam = new THREE.PerspectiveCamera(fov, W / H, 1, 3000);
      if (view === 'custom' && q.has('cam')) {
        const c = q.get('cam').split(',').map(Number);
        cam.position.set(c[0], c[1], c[2]); cam.lookAt(c[3], c[4], c[5]);
      } else {
        const r = (size.length() / 2) / Math.sin(THREE.MathUtils.degToRad(fov / 2)) * 0.92;
        const az = THREE.MathUtils.degToRad(num('az', 35)), el = THREE.MathUtils.degToRad(num('el', 35));
        cam.position.set(ctr.x + r * Math.cos(el) * Math.sin(az), ctr.y + r * Math.sin(el), ctr.z + r * Math.cos(el) * Math.cos(az));
        cam.lookAt(ctr);
      }
    }
    if (q.get('fit') !== '0') stage.fitShadow(box);
    const post = wantPost ? makePost(renderer, stage.scene, cam, { ao: q.get('ao') !== '0', dof: q.get('dof') === '1', aa: true }) : null;
    if (post) post.focusAt(ctr); window.__post = post;
    renderer.info.autoReset = false;   // count the whole frame (shadow pass + every post pass), not just the last renderer.render()
    const draw = () => { renderer.info.reset(); if (post) post.render(); else renderer.render(stage.scene, cam); };
    draw(); const t0 = performance.now(); draw(); const frameMs = performance.now() - t0;

    let meshes = 0, tris = 0;
    kit.root.traverseVisible((o) => {
      if (!(o.isMesh || o.isInstancedMesh)) return; meshes++;
      const g = o.geometry, n = (g.index ? g.index.count : g.attributes.position.count) / 3;
      tris += n * (o.isInstancedMesh ? o.count : 1);
    });
    window.__stats = { meshes, triangles: Math.round(tris), canvas: [W, H], drawCalls: renderer.info.render.calls, post: post ? post.state : null, passes: post ? post.passCount : 0, frameMs: Math.round(frameMs) };
    window.__stage = stage; window.__kit = kit; window.__cam = cam; window.__renderer = renderer;
    window.__ready = true;
  } catch (e) { console.error(e); window.__error = String(e && e.stack || e); }
})();
