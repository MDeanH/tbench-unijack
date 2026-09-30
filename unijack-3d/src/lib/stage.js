import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const BG = '#080b10';

/** Lighting rig shared by the viewer and the QA renderer so QA images show what users see. */
export function makeStage(renderer, { shadows = true } = {}) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;   // Khronos PBR Neutral: keeps solder-mask hue and saturation (ACES lifts red in saturated teal)
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.03);
  scene.environment = env.texture; scene.environmentIntensity = 0.85;
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight('#dff1ff', '#0b1118', 0.8));
  const key = new THREE.DirectionalLight('#fff4e6', 2.3);
  key.position.set(-90, 170, 70); key.castShadow = shadows;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -140, right: 140, top: 140, bottom: -140, near: 10, far: 500 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.35;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#6fd6ff', 1.2);
  rim.position.set(120, 60, -130); scene.add(rim);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.ShadowMaterial({ opacity: 0.3 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -1.75; ground.receiveShadow = true; ground.name = 'ground';
  scene.add(ground);
  return { scene, key, rim, ground, env };
}
