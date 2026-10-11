import * as THREE from 'three';

export const PHOTO_GAIN = 0.41;   // calibrated (see photoTop)
/**
 * Environment-reflection strength of the SOLDER MASK on photo faces (metal pixels always reflect the environment at full strength).
 * Why so low: the RoomEnvironment has a lamp at the zenith, and a top-down view mirrors it in a glossy mask, which is not in the photos
 * (their lights were off-axis) and would break the luminance calibration. The key light's own highlight is NOT scaled by this.
 * Note: in three r186 `material.envMapIntensity` is overwritten by `scene.environmentIntensity` whenever `scene.environment` is used,
 * so this is applied per pixel inside the shader (photoTop) and the old `env:` option of photoTop has no effect.
 */
export const PHOTO_ENV = 0.25;
export const PHOTO_NORMAL_SCALE = 0.55;   // mild relief from the derived normal map (silkscreen proud, pads below the mask)
/**
 * Specular colour (F0) of metal pixels = the photo's own colour times this. ASSUMED: the photographed grey of a tinned pad (about 0.3 linear)
 * is the pad's reflection of the photographer's softbox, not its reflectance; typical tin / solder reflectance is about 0.6 to 0.8, and 1.5
 * brings the mean pad towards it (about 0.5) while keeping the photo's own hue (gold stays gold, tin stays neutral). The GLB export carries the plain photo colour.
 */
export const PHOTO_METAL_F0 = 1.5;

/** Shared PBR material library. Colours are illustrative, chosen to read like the photos. */
export function makeMaterials() {
  const std = (color, roughness, metalness = 0, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  return {
    fr4Edge: std('#cfd8d2', 0.72),                 // exposed FR4 at the board edge: pale grey-green, as in gallery-1 (was khaki)
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
    photoTop(map, { roughness = 0.8 } = {}) {
      const g = globalThis.__PHOTO_GAIN ?? PHOTO_GAIN;
      const d = map.userData.derived;   // per-pixel finish maps derived from this photo (context.js); without them the face is uniformly matte as before
      const m = new THREE.MeshStandardMaterial({
        map, color: new THREE.Color(g, g, g),
        // with maps, roughness/metalness are the map values (factor 1): mask ~0.45 dielectric, silk ~0.78, pads/gold ~0.3 metallic
        roughness: d?.rm ? 1 : roughness, metalness: d?.rm ? 1 : 0, roughnessMap: d?.rm || null, metalnessMap: d?.rm || null,
        normalMap: d?.nrm || null, normalScale: new THREE.Vector2(PHOTO_NORMAL_SCALE, PHOTO_NORMAL_SCALE),
      });
      if (d?.rm) {
        // Two per-pixel corrections keyed on the metalness map:
        //  * the gain is a lighting calibration for DIFFUSE surfaces (the photo already contains the photographer's light); for a metal the
        //    texel is its specular colour (F0), so the gain is undone there and F0 = the photo's own colour times PHOTO_METAL_F0. Dielectric pixels are unchanged.
        //  * the environment radiance reflected by the mask is scaled by PHOTO_ENV (see above); metals reflect it fully.
        const maskEnv = globalThis.__PHOTO_ENV ?? PHOTO_ENV;
        m.onBeforeCompile = (sh) => {
          sh.uniforms.photoMetalGain = { value: (globalThis.__PHOTO_METAL_F0 ?? PHOTO_METAL_F0) / g }; sh.uniforms.photoMaskEnv = { value: maskEnv };
          sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform float photoMetalGain;\nuniform float photoMaskEnv;\nfloat photoEnvScale = 1.0;')
            .replace('#include <envmap_physical_pars_fragment>', THREE.ShaderChunk.envmap_physical_pars_fragment.replaceAll('return envMapColor.rgb * envMapIntensity;', 'return envMapColor.rgb * envMapIntensity * photoEnvScale;'))
            .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n\tphotoEnvScale = mix(photoMaskEnv, 1.0, metalnessFactor);\n\tdiffuseColor.rgb *= mix(1.0, photoMetalGain, metalnessFactor);');
        };
        m.customProgramCacheKey = () => 'photoTop-finish';
      }
      return m;
    },
  };
}
