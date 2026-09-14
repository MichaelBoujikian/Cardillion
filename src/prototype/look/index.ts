/**
 * Look prototype (milestone M1). Throwaway. Answers one question: can web + three.js hit the
 * Inscryption-grade bar for the battle screen — sunlit garden near, dark thicket far?
 */
import * as THREE from 'three';
import { mountHud } from './hud';
import { makePost } from './post';
import { buildScene } from './scene';

export function mountLook(root: HTMLElement): () => void {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.inset = '0';
  root.appendChild(renderer.domElement);

  const look = buildScene();
  const post = makePost(renderer, look.scene, look.camera);
  const hud = mountHud(root, look.enemies);

  let w = 1;
  let h = 1;
  const resize = () => {
    w = root.clientWidth || window.innerWidth;
    h = root.clientHeight || window.innerHeight;
    renderer.setSize(w, h);
    post.setSize(w, h);
    look.resize(w / h);
  };
  resize();
  window.addEventListener('resize', resize);

  const timer = new THREE.Timer();
  // Debug: `?t=1.1` freezes the animation clock so a moment can be screenshotted.
  const frozen = Number(new URLSearchParams(window.location.search).get('t'));
  let raf = 0;
  const frame = () => {
    timer.update();
    const dt = timer.getDelta();
    const t = Number.isFinite(frozen) && frozen > 0 ? frozen : timer.getElapsed();
    const { hit } = look.update(dt, t);
    if (hit) hud.hit(hit, 4);
    post.setTime(t);
    post.composer.render();
    hud.update(look.camera, look.enemies, w, h);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    renderer.dispose();
    hud.el.remove();
    renderer.domElement.remove();
  };
}
