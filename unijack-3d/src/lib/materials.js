import * as THREE from 'three';

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
    /** Photo-textured top face. The photo already contains its own lighting, so keep env response modest. */
    photoTop(map, { roughness = 0.62, env = 0.55 } = {}) {
      return new THREE.MeshStandardMaterial({ map, roughness, metalness: 0, envMapIntensity: env });
    },
  };
}
