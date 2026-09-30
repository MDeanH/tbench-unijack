import * as THREE from 'three';

export const PHOTO_GAIN = 0.41;   // calibrated (see photoTop)
export const PHOTO_ENV = 0.05;

/** Shared PBR material library. Colours are illustrative, chosen to read like the photos. */
export function makeMaterials() {
  const std = (color, roughness, metalness = 0, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  return {
    fr4Edge: std('#a39b6a', 0.72),                 // exposed FR4 at the board edge
    maskBottom: std('#0a4f6b', 0.5),               // PLAIN underside: undersides of base + PeriBoard are NOT photographed
    gold: std('#d9b15a', 0.3, 1),
    tin: std('#c9cdd1', 0.34, 1),
    steel: std('#aeb5bb', 0.28, 1),
    darkSteel: std('#6f767c', 0.4, 1),
    icBlack: std('#16181c', 0.48),
    icGrey: std('#2a2e33', 0.5),
    plasticBlack: std('#101215', 0.55),
    plasticDark: std('#34393c', 0.55),
    plasticGrey: std('#5b6063', 0.5),
    plasticCream: std('#dcd8c8', 0.42),
    plasticBrown: std('#4a3a2c', 0.45),
    terminalGreen: std('#2fb35f', 0.42),
    usbGold: std('#c58a2a', 0.3, 0.9),
    ceramic: std('#b9a98c', 0.6),
    ledLens: std('#e8e4d8', 0.4),
    /**
     * Photo-textured face. The photo already contains its own lighting and highlights, so this material must NOT re-light it
     * at full strength: `gain` scales the albedo and the reflection is kept low. Calibrated so a top-down render matches the
     * photo's mean solder-mask colour (tools/colorcal.py). Override with window.__PHOTO_GAIN for calibration runs.
     */
    photoTop(map, { roughness = 0.8, env = PHOTO_ENV } = {}) {
      const g = globalThis.__PHOTO_GAIN ?? PHOTO_GAIN;
      return new THREE.MeshStandardMaterial({ map, color: new THREE.Color(g, g, g), roughness, metalness: 0, envMapIntensity: globalThis.__PHOTO_ENV ?? env });
    },
  };
}
