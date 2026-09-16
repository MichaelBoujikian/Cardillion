/**
 * Battle post-processing: bloom on emissive (eyes, sun gem, flash), then one custom pass that adds
 * film grain, a vignette and a warm-near / cool-far colour split.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const GrainVignetteShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    time: { value: 0 },
    grain: { value: 0.06 },
    vignette: { value: 0.75 },
    resolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float grain;
    uniform float vignette;
    uniform vec2 resolution;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      float far = smoothstep(0.40, 1.0, vUv.y);
      float near = smoothstep(0.55, 0.0, vUv.y);

      // Chromatic fringing creeps in on the far side, like a cheap lens in a dark room.
      vec2 dir = (vUv - 0.5) * far * 0.006;
      vec4 c = texture2D(tDiffuse, vUv);
      c.r = texture2D(tDiffuse, vUv + dir).r;
      c.b = texture2D(tDiffuse, vUv - dir).b;

      // Depth grade. Near: warm and soft. Far: desaturated, crushed blacks, cold.
      float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(c.rgb, c.rgb * vec3(1.06, 1.0, 0.92), near * 0.5);
      c.rgb = mix(c.rgb, vec3(lum), far * 0.55);
      c.rgb = mix(c.rgb, c.rgb * vec3(0.78, 0.84, 1.0), far * 0.7);
      c.rgb = mix(c.rgb, (c.rgb - 0.025) * 1.22, far * 0.8);

      // Grain: fine and gentle in the garden, coarse and heavy in the thicket.
      float g1 = hash(floor(vUv * resolution * 0.75) + fract(time * 7.0) * 100.0) - 0.5;
      float g2 = hash(floor(vUv * resolution * 0.33) + fract(time * 5.0) * 77.0) - 0.5;
      float amount = grain * (1.15 - clamp(lum, 0.0, 1.0)) * (1.0 + far * 0.9);
      c.rgb += mix(g1, g2, far * 0.45) * amount;

      // Vignette.
      vec2 d = (vUv - 0.5) * vec2(1.0, 1.15);
      float v = 1.0 - smoothstep(0.30, 0.98, length(d) * 1.35);
      c.rgb *= mix(1.0, v, vignette);

      gl_FragColor = c;
    }
  `,
};

export interface Post {
  composer: EffectComposer;
  setSize(w: number, h: number): void;
  setTime(t: number): void;
  /** Film grain amount; 0 turns it off (Reduce motion). The vignette always stays. */
  setGrain(amount: number): void;
}

export const GRAIN_DEFAULT = 0.06;

export function makePost(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
): Post {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(size.clone(), 0.65, 0.5, 1.5);
  composer.addPass(bloom);
  const grade = new ShaderPass(GrainVignetteShader);
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  const uniforms = grade.uniforms as typeof GrainVignetteShader.uniforms;
  return {
    composer,
    setSize(w, h) {
      composer.setSize(w, h);
      bloom.setSize(w, h);
      uniforms.resolution.value.set(w, h);
    },
    setTime(t) {
      uniforms.time.value = t;
    },
    setGrain(amount) {
      uniforms.grain.value = amount;
    },
  };
}
