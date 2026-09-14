/**
 * The battle-table scene: sunlit garden near the camera, fog and thicket at the far end,
 * two rats standing in the gloom, a card on the table and one in flight.
 */
import * as THREE from 'three';
import {
  RAT_EYES,
  cardTexture,
  makeGlowTexture,
  makeGoboTexture,
  makeRatTexture,
  makeTableTexture,
} from './textures';

export interface Enemy {
  root: THREE.Object3D;
  sprite: THREE.Mesh;
  hp: number;
  maxHp: number;
  intent: string;
  /** World-space anchor points for the DOM overlay. */
  headAnchor: THREE.Vector3;
  feetAnchor: THREE.Vector3;
}

export interface LookScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  enemies: Enemy[];
  /** Advance animations. `dt` seconds, `t` total seconds. Returns a hit event when the demo card lands. */
  update(dt: number, t: number): { hit?: Enemy };
  resize(aspect: number): void;
}

const FOG_COLOR = 0x0d0c12;

function rnd(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildScene(): LookScene {
  const r = rnd(3);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG_COLOR);
  scene.fog = new THREE.Fog(FOG_COLOR, 10, 34);

  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 80);
  camera.position.set(0, 4.6, 7.2);
  camera.lookAt(0, 0.7, -3.5);

  // ---------- table ----------
  const table = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 34),
    new THREE.MeshStandardMaterial({ map: makeTableTexture(), roughness: 0.95, metalness: 0 }),
  );
  table.rotation.x = -Math.PI / 2;
  table.position.set(0, 0, -9);
  table.receiveShadow = true;
  scene.add(table);

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0x3d4a6b, 0x1a2610, 0.7));

  // Sunlight: a warm spot with a leaf gobo for dappled light on the near table.
  const sun = new THREE.SpotLight(0xfff0c8, 175, 30, 0.62, 0.85, 1.6);
  sun.position.set(-5, 11, 5);
  sun.target.position.set(0.5, 0, 1.5);
  sun.map = makeGoboTexture();
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.radius = 4;
  scene.add(sun, sun.target);

  // Candle-warm point light close to the player; flickers.
  const warm = new THREE.PointLight(0xffc27a, 28, 18, 1.8);
  warm.position.set(-2.6, 4.2, 5.2);
  scene.add(warm);

  // Cold moonlight from behind the thicket: silhouettes separate from the dark.
  const moon = new THREE.DirectionalLight(0x8090ff, 2.2);
  moon.position.set(4, 9, -18);
  moon.target.position.set(0, 0, -6);
  scene.add(moon, moon.target);

  // The garden's warm light spills onto the nearest enemies (spec §11.1).
  const spill = new THREE.SpotLight(0xffb070, 240, 26, 0.34, 0.6, 1.4);
  spill.position.set(0.3, 6.5, 0.5);
  spill.target.position.set(0, 1, -6.5);
  scene.add(spill, spill.target);

  // Cold fill over the thicket so roots and trees read as silhouettes, not void.
  const gloom = new THREE.PointLight(0x6a76a8, 480, 34, 1.6);
  gloom.position.set(0, 7, -10);
  scene.add(gloom);

  // ---------- garden props (near) ----------
  const garden = new THREE.Group();
  scene.add(garden);
  const petalColors = [0xffd84a, 0xff7fa3, 0xffffff, 0xffa54a, 0xc9a6ff, 0xff5c7a];
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x4f8a2e, roughness: 0.9 });
  const flowerGeo = new THREE.CircleGeometry(0.16, 12);
  const centreGeo = new THREE.CircleGeometry(0.06, 10);
  const centreMat = new THREE.MeshStandardMaterial({ color: 0x4a3418, roughness: 1 });
  for (let i = 0; i < 34; i++) {
    const x = (r() - 0.5) * 13;
    const z = 0.2 + r() * 5.6;
    if (Math.abs(x) < 2.6 && z > 1.6 && z < 4) continue; // keep the card lane clear
    const h = 0.35 + r() * 0.5;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, h, 5), stemMat);
    stem.position.set(x, h / 2, z);
    stem.castShadow = true;
    const petals = new THREE.Mesh(
      flowerGeo,
      new THREE.MeshStandardMaterial({
        color: petalColors[Math.floor(r() * petalColors.length)] ?? 0xffd84a,
        roughness: 0.8,
        side: THREE.DoubleSide,
      }),
    );
    petals.position.set(x, h, z);
    petals.rotation.x = -Math.PI / 2 + 0.6 + r() * 0.4;
    petals.rotation.z = r() * Math.PI;
    petals.scale.setScalar(0.7 + r() * 0.8);
    petals.castShadow = true;
    const centre = new THREE.Mesh(centreGeo, centreMat);
    centre.position.copy(petals.position);
    centre.rotation.copy(petals.rotation);
    centre.position.y += 0.005;
    garden.add(stem, petals, centre);
  }
  const pebbleMat = new THREE.MeshStandardMaterial({ color: 0xbfb6a6, roughness: 0.9 });
  for (let i = 0; i < 22; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.08 + r() * 0.14, 8, 6), pebbleMat);
    p.position.set((r() - 0.5) * 14, 0.02, -0.5 + r() * 6);
    p.scale.y = 0.45;
    p.castShadow = true;
    p.receiveShadow = true;
    garden.add(p);
  }
  // Mushrooms: cute, red, white-dotted.
  const capMat = new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.7 });
  const stalkMat = new THREE.MeshStandardMaterial({ color: 0xf3e7c9, roughness: 0.9 });
  const dotMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  for (const [mx, mz, ms] of [
    [-4.6, 3.4, 1.1],
    [4.9, 2.6, 0.8],
    [5.4, 3.1, 0.55],
  ] as const) {
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.42, 8), stalkMat);
    stalk.position.set(mx, 0.21, mz);
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      capMat,
    );
    cap.position.set(mx, 0.4, mz);
    const grp = new THREE.Group();
    grp.add(stalk, cap);
    for (let k = 0; k < 5; k++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), dotMat);
      const a = r() * Math.PI * 2;
      const e = 0.3 + r() * 0.9;
      d.position.set(
        mx + Math.cos(a) * Math.sin(e) * 0.28,
        0.4 + Math.cos(e) * 0.28,
        mz + Math.sin(a) * Math.sin(e) * 0.28,
      );
      grp.add(d);
    }
    grp.scale.setScalar(ms);
    grp.position.y = 0;
    grp.traverse((o) => {
      o.castShadow = true;
    });
    garden.add(grp);
  }

  // Pollen motes drifting in the sunlight.
  const moteCount = 160;
  const motePos = new Float32Array(moteCount * 3);
  const moteSeed = new Float32Array(moteCount);
  for (let i = 0; i < moteCount; i++) {
    motePos[i * 3] = (r() - 0.5) * 13;
    motePos[i * 3 + 1] = 0.2 + r() * 3.2;
    motePos[i * 3 + 2] = -3 + r() * 9;
    moteSeed[i] = r() * 100;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const motes = new THREE.Points(
    moteGeo,
    new THREE.PointsMaterial({
      color: 0xffe9a8,
      size: 0.05,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      map: makeGlowTexture(),
    }),
  );
  scene.add(motes);

  // ---------- thicket props (far) ----------
  const thicket = new THREE.Group();
  scene.add(thicket);
  const rootMat = new THREE.MeshStandardMaterial({ color: 0x3a3442, roughness: 1 });
  for (let i = 0; i < 16; i++) {
    const x0 = (r() - 0.5) * 16;
    const z0 = -7 - r() * 12;
    const pts: THREE.Vector3[] = [];
    let p = new THREE.Vector3(x0, -0.2, z0);
    const dir = new THREE.Vector3((r() - 0.5) * 0.6, 0.8 + r() * 0.4, (r() - 0.5) * 0.6);
    const segs = 6 + Math.floor(r() * 5);
    for (let k = 0; k < segs; k++) {
      pts.push(p.clone());
      dir.x += (r() - 0.5) * 0.7;
      dir.z += (r() - 0.5) * 0.7;
      dir.y -= 0.12;
      p = p.clone().add(
        dir
          .clone()
          .normalize()
          .multiplyScalar(0.7 + r() * 0.6),
      );
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 24, 0.07 + r() * 0.12, 6, false),
      rootMat,
    );
    tube.castShadow = true;
    thicket.add(tube);
    // Thorns.
    for (let k = 0; k < 4; k++) {
      const at = curve.getPointAt(0.2 + r() * 0.7);
      const thorn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.35, 5), rootMat);
      thorn.position.copy(at);
      thorn.rotation.set(r() * 3, r() * 3, r() * 3);
      thicket.add(thorn);
    }
  }
  // Dead trees on the far edge.
  for (let i = 0; i < 7; i++) {
    const x = (r() - 0.5) * 18;
    const z = -14 - r() * 6;
    const h = 4 + r() * 5;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.35, h, 7), rootMat);
    trunk.position.set(x, h / 2, z);
    trunk.rotation.z = (r() - 0.5) * 0.25;
    thicket.add(trunk);
    for (let k = 0; k < 3; k++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.1, 1.5 + r() * 2, 5), rootMat);
      b.position.set(x + (r() - 0.5) * 1.2, h * (0.5 + r() * 0.45), z);
      b.rotation.z = (r() - 0.5) * 2.4;
      thicket.add(b);
    }
  }
  // Something very large, far back, that is only eyes and a shape.
  const bear = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x262030, roughness: 1 }),
  );
  bear.scale.set(1.3, 1.1, 1);
  bear.position.set(0.8, 1.8, -15.5);
  thicket.add(bear);

  const glow = makeGlowTexture();

  // Cobwebs strung between the roots and trees.
  const webMat = new THREE.LineBasicMaterial({ color: 0xb9b6c6, transparent: true, opacity: 0.4 });
  const anchors: THREE.Vector3[] = [];
  thicket.traverse((o) => {
    if (o instanceof THREE.Mesh && o.geometry instanceof THREE.CylinderGeometry) {
      anchors.push(o.position.clone().add(new THREE.Vector3(0, 1.2 + r() * 2, 0)));
    }
  });
  for (let i = 0; i < 26 && anchors.length > 1; i++) {
    const a = anchors[Math.floor(r() * anchors.length)] as THREE.Vector3;
    const b = anchors[Math.floor(r() * anchors.length)] as THREE.Vector3;
    if (a === b || a.distanceTo(b) > 9) continue;
    const pts: THREE.Vector3[] = [];
    const sag = 0.4 + r() * 1.2;
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      pts.push(
        new THREE.Vector3()
          .lerpVectors(a, b, t)
          .add(new THREE.Vector3(0, -Math.sin(t * Math.PI) * sag, 0)),
      );
    }
    thicket.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), webMat));
    // A few threads hanging off it.
    for (let k = 0; k < 3; k++) {
      const at = pts[1 + Math.floor(r() * 6)] as THREE.Vector3;
      const hang = [
        at.clone(),
        at.clone().add(new THREE.Vector3((r() - 0.5) * 0.3, -(0.3 + r() * 1.4), 0)),
      ];
      thicket.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(hang), webMat));
    }
  }

  // Ash drifting in the thicket: cold, slow, sparse.
  const ashCount = 220;
  const ashPos = new Float32Array(ashCount * 3);
  const ashSeed = new Float32Array(ashCount);
  for (let i = 0; i < ashCount; i++) {
    ashPos[i * 3] = (r() - 0.5) * 18;
    ashPos[i * 3 + 1] = r() * 6;
    ashPos[i * 3 + 2] = -5 - r() * 15;
    ashSeed[i] = r() * 100;
  }
  const ashGeo = new THREE.BufferGeometry();
  ashGeo.setAttribute('position', new THREE.BufferAttribute(ashPos, 3));
  const ash = new THREE.Points(
    ashGeo,
    new THREE.PointsMaterial({
      color: 0x8c8a99,
      size: 0.07,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      map: glow,
    }),
  );
  scene.add(ash);

  // Eyes in the dark: pairs of emissive dots that blink.
  const eyeMat = new THREE.SpriteMaterial({
    map: glow,
    color: new THREE.Color(1.0, 0.62, 0.18).multiplyScalar(6),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const farEyes: { grp: THREE.Group; seed: number }[] = [];
  const eyeSpots: [number, number, number, number][] = [
    [-5.2, 1.1, -11, 0.11],
    [4.6, 0.7, -12.5, 0.1],
    [-2.2, 2.4, -14, 0.09],
    [6.8, 1.6, -16, 0.08],
    [0.8, 2.6, -15.2, 0.22], // the big one
  ];
  for (const [x, y, z, s] of eyeSpots) {
    const grp = new THREE.Group();
    for (const dx of [-1, 1]) {
      const e = new THREE.Sprite(eyeMat);
      e.position.set(dx * s * 2.2, 0, 0);
      e.scale.setScalar(s);
      grp.add(e);
    }
    grp.position.set(x, y, z);
    thicket.add(grp);
    farEyes.push({ grp, seed: r() * 100 });
  }

  // ---------- enemies ----------
  const ratTex = makeRatTexture();
  const enemies: Enemy[] = [];
  const makeRat = (x: number, z: number, flip: boolean): Enemy => {
    const root = new THREE.Group();
    const size = 2.3;
    const sprite = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({
        map: ratTex,
        transparent: true,
        alphaTest: 0.35,
        roughness: 1,
        side: THREE.DoubleSide,
      }),
    );
    sprite.position.y = size / 2 - 0.08;
    if (flip) sprite.scale.x = -1;
    root.add(sprite);
    // Emissive eyes sitting exactly on the drawn ones.
    for (const [u, v] of RAT_EYES) {
      const e = new THREE.Sprite(eyeMat);
      const lx = (u - 0.5) * size * (flip ? -1 : 1);
      const ly = (0.5 - v) * size + sprite.position.y;
      e.position.set(lx, ly, 0.02);
      e.scale.setScalar(0.11);
      root.add(e);
    }
    // Contact shadow blob.
    const blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.9, 16),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.01;
    blob.scale.set(1.3, 0.6, 1);
    root.add(blob);
    root.position.set(x, 0, z);
    scene.add(root);
    return {
      root,
      sprite,
      hp: 11,
      maxHp: 11,
      intent: '⚔ 4',
      headAnchor: new THREE.Vector3(x, 2.45, z),
      feetAnchor: new THREE.Vector3(x, -0.05, z + 0.4),
    };
  };
  enemies.push(makeRat(-1.7, -5.6, false), makeRat(1.9, -6.2, true));

  // ---------- cards in the scene ----------
  const cardGeo = new THREE.PlaneGeometry(1.0, 1.4);
  const cardMatFor = (bug: Parameters<typeof cardTexture>[0]) =>
    new THREE.MeshStandardMaterial({
      map: cardTexture(bug),
      roughness: 0.55,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
  // One card lying on the table near the player.
  const restingCard = new THREE.Mesh(cardGeo, cardMatFor('roly-poly'));
  restingCard.rotation.set(-Math.PI / 2 + 0.12, 0, 0.18);
  restingCard.position.set(-4.6, 0.03, 1.4);
  restingCard.castShadow = true;
  restingCard.receiveShadow = true;
  scene.add(restingCard);
  // The demo card that flies to a rat.
  const flyingCard = new THREE.Mesh(cardGeo, cardMatFor('wormillion'));
  flyingCard.castShadow = true;
  scene.add(flyingCard);
  const flash = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glow,
      color: new THREE.Color(1, 0.85, 0.5).multiplyScalar(1.7),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    }),
  );
  flash.scale.setScalar(0);
  scene.add(flash);

  const from = new THREE.Vector3(0.9, 1.3, 3.8);
  const target = enemies[0] as Enemy;
  const to = new THREE.Vector3(target.root.position.x, 1.2, target.root.position.z + 0.3);
  const LOOP = 3.4;
  let hitFired = false;

  function update(dt: number, t: number): { hit?: Enemy } {
    // Light flicker.
    warm.intensity =
      28 + Math.sin(t * 9.1) * 1.6 + Math.sin(t * 23.7) * 1.1 + Math.sin(t * 2.3) * 2;
    // Motes drift.
    const arr = moteGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < moteCount; i++) {
      const s = moteSeed[i] as number;
      arr.setX(i, arr.getX(i) + Math.sin(t * 0.4 + s) * 0.0025);
      arr.setY(i, arr.getY(i) + Math.cos(t * 0.3 + s * 1.3) * 0.0018);
    }
    arr.needsUpdate = true;
    const ap = ashGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < ashCount; i++) {
      const s = ashSeed[i] as number;
      let y = ap.getY(i) - 0.004 - Math.sin(t * 0.5 + s) * 0.002;
      if (y < 0) y = 6;
      ap.setY(i, y);
      ap.setX(i, ap.getX(i) + Math.sin(t * 0.25 + s) * 0.002);
    }
    ap.needsUpdate = true;
    // Rats breathe and shift their weight.
    enemies.forEach((e, i) => {
      const s = 1 + Math.sin(t * 1.7 + i * 2.1) * 0.02;
      e.sprite.scale.y = s;
      e.root.position.x += Math.sin(t * 0.9 + i) * 0.0006;
    });
    // Far eyes blink.
    for (const { grp, seed } of farEyes) {
      const blink = Math.sin(t * 0.7 + seed) > 0.96 ? 0 : 1;
      grp.scale.setScalar(blink);
    }
    // Flying card loop.
    const p = t % LOOP;
    let out: { hit?: Enemy } = {};
    if (p < 0.55) {
      const k = p / 0.55;
      flyingCard.visible = true;
      flyingCard.position.set(from.x, from.y + k * 0.8, from.z - k * 0.4);
      flyingCard.rotation.set(-0.9 + k * 0.4, 0.1, 0.15);
      flyingCard.material.opacity = 1;
      hitFired = false;
    } else if (p < 1.35) {
      const k = (p - 0.55) / 0.8;
      const ease = k * k * (3 - 2 * k);
      flyingCard.position.lerpVectors(
        new THREE.Vector3(from.x, from.y + 0.8, from.z - 0.4),
        to,
        ease,
      );
      flyingCard.position.y += Math.sin(ease * Math.PI) * 1.1;
      flyingCard.rotation.set(-0.5 - ease * 0.6, ease * Math.PI * 2, 0.15 + ease * 0.5);
    } else if (p < 1.75) {
      const k = (p - 1.35) / 0.4;
      flyingCard.visible = k < 0.35;
      flash.position.copy(to).add(new THREE.Vector3(0, 0.1, 0.3));
      flash.scale.setScalar((1 - k) * 1.1);
      target.sprite.position.x = Math.sin(k * 30) * 0.08 * (1 - k);
      if (!hitFired) {
        hitFired = true;
        out = { hit: target };
      }
    } else {
      flyingCard.visible = false;
      flash.scale.setScalar(0);
      target.sprite.position.x = 0;
    }
    void dt;
    return out;
  }

  function resize(aspect: number): void {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }

  return { scene, camera, enemies, update, resize };
}
