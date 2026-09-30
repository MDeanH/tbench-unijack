// Headless GLB export page, driven by tools/export-glb.mjs. Exports the kit in its assembled pose with named nodes
// and the honesty metadata (ref/label/kind/status/desc) carried in glTF "extras".
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createUniJack } from './model.js';

(async () => {
  try {
    const kit = await createUniJack();
    kit.setInsertion(1); kit.setExplode(0);
    kit.root.getObjectByName('explode-guides')?.removeFromParent();
    kit.root.traverse((o) => {                                   // photo textures as JPEG keeps the GLB small
      for (const m of [].concat(o.material || [])) if (m.map) m.map.userData.mimeType = 'image/jpeg';
      if (o.isMesh || o.isInstancedMesh) { o.castShadow = o.receiveShadow = false; }
    });
    kit.root.userData.note = 'Illustrative, photo-anchored model of the UniJack kit. NOT CAD. Units: millimetres. Heights, stack height, PCB thickness and insertion angle are assumed. Undersides of the base board and PeriBoard were not photographed.';
    const buf = await new GLTFExporter().parseAsync(kit.root, { binary: true, maxTextureSize: 2048 });
    let bin = ''; const u8 = new Uint8Array(buf); const CH = 0x8000;
    for (let i = 0; i < u8.length; i += CH) bin += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    window.__glb = btoa(bin); window.__ready = true;
  } catch (e) { console.error(e); window.__error = String((e && e.stack) || e); }
})();
