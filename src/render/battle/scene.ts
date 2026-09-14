/**
 * The battle scene: the sunlit table fading into the thicket, enemy sprites placed from
 * combat state, and the animations the event animator asks for (card flight, hits, deaths,
 * Greeble reveal, camera shake). It never reads or mutates combat state itself.
 */
import { enemyDef } from '@content/enemies';
import type { EnemyInstance } from '@engine/types';
import * as THREE from 'three';
import { makePost, type Post } from './post';
import {
  PLACEHOLDER_EYES,
  findGlowPoints,
  imageTexture,
  makeGlowTexture,
  makeGoboTexture,
  makeTableTexture,
  makeVerminPlaceholder,
  srgbTexture,
  type ArtCache,
} from './textures';

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

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface EnemySprite {
  uid: string;
  def: string;
  root: THREE.Group;
  plane: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  eyes: THREE.Sprite[];
  width: number;
  height: number;
  unseen: boolean;
  /** 0 = hidden (Unseen), 1 = fully shown. */
  reveal: number;
  revealTarget: number;
  dead: boolean;
  /** Transient recoil offset applied on hits. */
  recoil: number;
}

export interface ScreenRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class BattleScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 80);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly post: Post;
  private readonly art: ArtCache;
  private readonly glow: THREE.Texture;
  private readonly eyeMat: THREE.SpriteMaterial;
  private readonly flash: THREE.Sprite;
  private readonly enemyGroup = new THREE.Group();
  private sprites = new Map<string, EnemySprite>();
  private readonly cardGeo = new THREE.PlaneGeometry(1.0, 1.4);
  private warm!: THREE.PointLight;
  private motes!: THREE.Points;
  private moteSeed!: Float32Array;
  private ash!: THREE.Points;
  private ashSeed!: Float32Array;
  private farEyes: { grp: THREE.Group; seed: number }[] = [];
  private shakeAmt = 0;
  private readonly basePos = new THREE.Vector3(0, 4.6, 7.2);
  private readonly lookAt = new THREE.Vector3(0, 0.7, -3.5);
  private w = 1;
  private h = 1;
  private readonly tmp = new THREE.Vector3();

  constructor(root: HTMLElement, art: ArtCache) {
    this.art = art;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.inset = '0';
    root.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(FOG_COLOR);
    this.scene.fog = new THREE.Fog(FOG_COLOR, 10, 34);
    this.camera.position.copy(this.basePos);
    this.camera.lookAt(this.lookAt);

    this.glow = makeGlowTexture();
    this.eyeMat = new THREE.SpriteMaterial({
      map: this.glow,
      color: new THREE.Color(1.0, 0.62, 0.18).multiplyScalar(6),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    this.flash = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glow,
        color: new THREE.Color(1, 0.85, 0.5).multiplyScalar(1.7),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    );
    this.flash.scale.setScalar(0);
    this.scene.add(this.flash);
    this.scene.add(this.enemyGroup);
    this.buildEnvironment();
    this.post = makePost(this.renderer, this.scene, this.camera);
  }

  // ---------- environment (ported from the M1 look prototype) ----------

  private buildEnvironment(): void {
    const r = rnd(3);
    const scene = this.scene;

    const table = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 34),
      new THREE.MeshStandardMaterial({ map: makeTableTexture(), roughness: 0.95, metalness: 0 }),
    );
    table.rotation.x = -Math.PI / 2;
    table.position.set(0, 0, -9);
    table.receiveShadow = true;
    scene.add(table);

    scene.add(new THREE.HemisphereLight(0x3d4a6b, 0x1a2610, 0.7));
    const sun = new THREE.SpotLight(0xfff0c8, 175, 30, 0.62, 0.85, 1.6);
    sun.position.set(-5, 11, 5);
    sun.target.position.set(0.5, 0, 1.5);
    sun.map = makeGoboTexture();
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    scene.add(sun, sun.target);
    this.warm = new THREE.PointLight(0xffc27a, 28, 18, 1.8);
    this.warm.position.set(-2.6, 4.2, 5.2);
    scene.add(this.warm);
    const moon = new THREE.DirectionalLight(0x8090ff, 2.2);
    moon.position.set(4, 9, -18);
    moon.target.position.set(0, 0, -6);
    scene.add(moon, moon.target);
    const spill = new THREE.SpotLight(0xffb070, 240, 26, 0.34, 0.6, 1.4);
    spill.position.set(0.3, 6.5, 0.5);
    spill.target.position.set(0, 1, -6.5);
    scene.add(spill, spill.target);
    const gloom = new THREE.PointLight(0x6a76a8, 480, 34, 1.6);
    gloom.position.set(0, 7, -10);
    scene.add(gloom);

    // Garden props.
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
      if (Math.abs(x) < 2.6 && z > 1.6 && z < 4) continue;
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
    const capMat = new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.7 });
    const stalkMat = new THREE.MeshStandardMaterial({ color: 0xf3e7c9, roughness: 0.9 });
    const dotMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    for (const [mx, mz, ms] of [
      [-4.6, 3.4, 1.1],
      [4.9, 2.6, 0.8],
      [5.4, 3.1, 0.55],
    ] as const) {
      const grp = new THREE.Group();
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.42, 8), stalkMat);
      stalk.position.set(mx, 0.21, mz);
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        capMat,
      );
      cap.position.set(mx, 0.4, mz);
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
      grp.traverse((o) => {
        o.castShadow = true;
      });
      garden.add(grp);
    }

    // Pollen motes.
    const moteCount = 160;
    const motePos = new Float32Array(moteCount * 3);
    this.moteSeed = new Float32Array(moteCount);
    for (let i = 0; i < moteCount; i++) {
      motePos[i * 3] = (r() - 0.5) * 13;
      motePos[i * 3 + 1] = 0.2 + r() * 3.2;
      motePos[i * 3 + 2] = -3 + r() * 9;
      this.moteSeed[i] = r() * 100;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
    this.motes = new THREE.Points(
      moteGeo,
      new THREE.PointsMaterial({
        color: 0xffe9a8,
        size: 0.05,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        map: this.glow,
      }),
    );
    scene.add(this.motes);

    // Thicket.
    const thicket = new THREE.Group();
    scene.add(thicket);
    const rootMat = new THREE.MeshStandardMaterial({ color: 0x3a3442, roughness: 1 });
    for (let i = 0; i < 16; i++) {
      const pts: THREE.Vector3[] = [];
      let p = new THREE.Vector3((r() - 0.5) * 16, -0.2, -7 - r() * 12);
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
      for (let k = 0; k < 4; k++) {
        const thorn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.35, 5), rootMat);
        thorn.position.copy(curve.getPointAt(0.2 + r() * 0.7));
        thorn.rotation.set(r() * 3, r() * 3, r() * 3);
        thicket.add(thorn);
      }
    }
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
    const mound = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0x262030, roughness: 1 }),
    );
    mound.scale.set(1.3, 1.1, 1);
    mound.position.set(0.8, 1.8, -15.5);
    thicket.add(mound);

    // Cobwebs between anchors.
    const webMat = new THREE.LineBasicMaterial({
      color: 0xb9b6c6,
      transparent: true,
      opacity: 0.4,
    });
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
      for (let k = 0; k < 3; k++) {
        const at = pts[1 + Math.floor(r() * 6)] as THREE.Vector3;
        const hang = [
          at.clone(),
          at.clone().add(new THREE.Vector3((r() - 0.5) * 0.3, -(0.3 + r() * 1.4), 0)),
        ];
        thicket.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(hang), webMat));
      }
    }

    // Ash.
    const ashCount = 220;
    const ashPos = new Float32Array(ashCount * 3);
    this.ashSeed = new Float32Array(ashCount);
    for (let i = 0; i < ashCount; i++) {
      ashPos[i * 3] = (r() - 0.5) * 18;
      ashPos[i * 3 + 1] = r() * 6;
      ashPos[i * 3 + 2] = -5 - r() * 15;
      this.ashSeed[i] = r() * 100;
    }
    const ashGeo = new THREE.BufferGeometry();
    ashGeo.setAttribute('position', new THREE.BufferAttribute(ashPos, 3));
    this.ash = new THREE.Points(
      ashGeo,
      new THREE.PointsMaterial({
        color: 0x8c8a99,
        size: 0.07,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        map: this.glow,
      }),
    );
    scene.add(this.ash);

    // Eyes in the dark.
    const eyeSpots: [number, number, number, number][] = [
      [-5.2, 1.1, -11, 0.11],
      [4.6, 0.7, -12.5, 0.1],
      [-2.2, 2.4, -14, 0.09],
      [6.8, 1.6, -16, 0.08],
      [0.8, 2.6, -15.2, 0.22],
    ];
    for (const [x, y, z, s] of eyeSpots) {
      const grp = new THREE.Group();
      for (const dx of [-1, 1]) {
        const e = new THREE.Sprite(this.eyeMat);
        e.position.set(dx * s * 2.2, 0, 0);
        e.scale.setScalar(s);
        grp.add(e);
      }
      grp.position.set(x, y, z);
      thicket.add(grp);
      this.farEyes.push({ grp, seed: r() * 100 });
    }
  }

  // ---------- enemies ----------

  /** Drop every enemy sprite (a new fight reuses uids, so stale sprites must not survive). */
  clearEnemies(): void {
    for (const sprite of this.sprites.values()) this.enemyGroup.remove(sprite.root);
    this.sprites.clear();
  }

  /** Create/keep/remove sprites so the scene matches the given enemies, spread across the table. */
  setEnemies(enemies: EnemyInstance[]): void {
    const keep = new Set(enemies.map((e) => e.uid));
    for (const [uid, sprite] of this.sprites) {
      if (!keep.has(uid)) {
        this.enemyGroup.remove(sprite.root);
        this.sprites.delete(uid);
      }
    }
    const n = enemies.length;
    enemies.forEach((enemy, i) => {
      let sprite = this.sprites.get(enemy.uid);
      if (!sprite) {
        sprite = this.makeSprite(enemy);
        this.sprites.set(enemy.uid, sprite);
        this.enemyGroup.add(sprite.root);
      }
      // Spread across the far table; stagger depth so neighbours overlap less.
      const spread = n <= 2 ? 3.6 : n === 3 ? 3.1 : 9.4 / n;
      const x = (i - (n - 1) / 2) * spread;
      const z = -5.4 - (i % 2) * 1.1;
      sprite.root.position.set(x, 0, z);
      if (enemy.hp <= 0 && !sprite.dead) {
        sprite.dead = true;
        sprite.root.visible = false;
      }
    });
  }

  private makeSprite(enemy: EnemyInstance): EnemySprite {
    const def = enemyDef(enemy.def);
    const img = this.art.get(def.art);
    const unseen = def.traits.includes('unseen');
    const texture = img ? imageTexture(img) : makeVerminPlaceholder(enemy.def);
    const aspect = img ? img.height / img.width : 1;
    const height =
      (def.tier === 'boss' ? 4.2 : def.tier === 'elite' ? 3.3 : 2.6) * (img ? 1 : 0.85);
    const width = height / aspect;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        alphaTest: unseen ? 0 : 0.35,
        roughness: 1,
        side: THREE.DoubleSide,
        opacity: 1,
      }),
    );
    plane.position.y = height / 2 - 0.08;
    const root = new THREE.Group();
    root.add(plane);
    const eyes: THREE.Sprite[] = [];
    const points = img ? findGlowPoints(img) : PLACEHOLDER_EYES;
    for (const [u, v] of points) {
      const e = new THREE.Sprite(this.eyeMat);
      e.position.set((u - 0.5) * width, (0.5 - v) * height + plane.position.y, 0.03);
      e.scale.setScalar(img ? 0.3 : 0.11);
      root.add(e);
      eyes.push(e);
    }
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
    blob.scale.set(width * 0.5, height * 0.2, 1);
    root.add(blob);
    const sprite: EnemySprite = {
      uid: enemy.uid,
      def: enemy.def,
      root,
      plane,
      eyes,
      width,
      height,
      unseen,
      reveal: unseen ? 0 : 1,
      revealTarget: unseen ? 0 : 1,
      dead: enemy.hp <= 0,
      recoil: 0,
    };
    this.applyReveal(sprite);
    return sprite;
  }

  private applyReveal(sprite: EnemySprite): void {
    const k = sprite.reveal;
    // Unseen creatures are a heat-shimmer at rest: faint, flickering, no solid alpha edge.
    sprite.plane.material.opacity = sprite.unseen ? 0.08 + 0.92 * k : 1;
    sprite.plane.material.alphaTest = sprite.unseen ? 0 : 0.35;
    for (const e of sprite.eyes) e.material = this.eyeMat;
    for (const e of sprite.eyes)
      e.scale.setScalar((sprite.unseen ? 0.12 + 0.18 * k : 0.3) * (sprite.width > 1.5 ? 1 : 0.4));
  }

  /** Reveal (or hide) an Unseen enemy; a no-op for seen ones. */
  setRevealed(uid: string, revealed: boolean): void {
    const s = this.sprites.get(uid);
    if (s && s.unseen) s.revealTarget = revealed ? 1 : 0;
  }

  /** Projected screen rectangle of an enemy's sprite, for targeting and labels. */
  enemyRect(uid: string): ScreenRect | null {
    const s = this.sprites.get(uid);
    if (!s || s.dead) return null;
    const p = s.root.position;
    const corners = [
      this.project(p.x - s.width / 2, 0, p.z),
      this.project(p.x + s.width / 2, s.height, p.z),
    ];
    const x0 = Math.min(corners[0]!.x, corners[1]!.x);
    const x1 = Math.max(corners[0]!.x, corners[1]!.x);
    const y0 = Math.min(corners[0]!.y, corners[1]!.y);
    const y1 = Math.max(corners[0]!.y, corners[1]!.y);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  enemyAnchor(uid: string, where: 'head' | 'feet'): { x: number; y: number } | null {
    const s = this.sprites.get(uid);
    if (!s) return null;
    const p = s.root.position;
    return this.project(p.x, where === 'head' ? s.height + 0.15 : -0.05, p.z + 0.4);
  }

  private project(x: number, y: number, z: number): { x: number; y: number } {
    this.tmp.set(x, y, z).project(this.camera);
    return { x: (this.tmp.x * 0.5 + 0.5) * this.w, y: (-this.tmp.y * 0.5 + 0.5) * this.h };
  }

  // ---------- animations ----------

  /**
   * Fly a card from a screen position into the scene and strike the target (or slam the table
   * for untargeted cards). Resolves at the moment of impact.
   */
  async flyCard(
    face: HTMLCanvasElement,
    from: { x: number; y: number },
    targetUid: string | null,
  ): Promise<void> {
    const mat = new THREE.MeshStandardMaterial({
      map: srgbTexture(face),
      roughness: 0.55,
      metalness: 0.02,
      side: THREE.DoubleSide,
      transparent: true,
    });
    const card = new THREE.Mesh(this.cardGeo, mat);
    card.castShadow = true;
    this.scene.add(card);
    const fx = from.x / Math.max(this.w, 1) - 0.5;
    const start = new THREE.Vector3(fx * 8, 1.3, 3.8);
    const target = this.sprites.get(targetUid ?? '');
    const end = target
      ? new THREE.Vector3(target.root.position.x, 1.2, target.root.position.z + 0.3)
      : new THREE.Vector3(0, 0.9, -1.2);
    const D = 520;
    const t0 = performance.now();
    await new Promise<void>((resolve) => {
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / D);
        const ease = k * k * (3 - 2 * k);
        card.position.lerpVectors(start, end, ease);
        card.position.y += Math.sin(ease * Math.PI) * 1.1;
        card.rotation.set(-0.5 - ease * 0.6, ease * Math.PI * 2, 0.15 + ease * 0.5);
        if (k < 1) requestAnimationFrame(step);
        else resolve();
      };
      step();
    });
    this.flash.position.copy(end).add(new THREE.Vector3(0, 0.1, 0.3));
    this.flash.scale.setScalar(1.1);
    const f0 = performance.now();
    const fade = () => {
      const k = Math.min(1, (performance.now() - f0) / 220);
      this.flash.scale.setScalar((1 - k) * 1.1);
      mat.opacity = 1 - k;
      if (k < 1) requestAnimationFrame(fade);
      else {
        this.scene.remove(card);
        mat.map?.dispose();
        mat.dispose();
      }
    };
    fade();
  }

  hitEnemy(uid: string): void {
    const s = this.sprites.get(uid);
    if (s) s.recoil = 1;
  }

  async killEnemy(uid: string): Promise<void> {
    const s = this.sprites.get(uid);
    if (!s || s.dead) return;
    s.dead = true;
    const t0 = performance.now();
    await new Promise<void>((resolve) => {
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / 600);
        s.plane.material.opacity = (1 - k) * (s.unseen ? 0.5 : 1);
        s.plane.rotation.x = -k * 1.2;
        s.plane.position.y = s.height / 2 - 0.08 - k * s.height * 0.45;
        for (const e of s.eyes) e.scale.setScalar(0.3 * (1 - k));
        if (k < 1) requestAnimationFrame(step);
        else resolve();
      };
      step();
    });
    s.root.visible = false;
  }

  reviveEnemy(uid: string): void {
    const s = this.sprites.get(uid);
    if (!s) return;
    s.dead = false;
    s.root.visible = true;
    s.plane.rotation.x = 0;
    s.plane.position.y = s.height / 2 - 0.08;
    this.applyReveal(s);
    s.recoil = 1;
  }

  shake(strength: number): void {
    this.shakeAmt = Math.max(this.shakeAmt, strength);
  }

  // ---------- frame ----------

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.renderer.setSize(w, h);
    this.post.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number, t: number): void {
    this.warm.intensity =
      28 + Math.sin(t * 9.1) * 1.6 + Math.sin(t * 23.7) * 1.1 + Math.sin(t * 2.3) * 2;
    const mp = this.motes.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < mp.count; i++) {
      const s = this.moteSeed[i] as number;
      mp.setX(i, mp.getX(i) + Math.sin(t * 0.4 + s) * 0.0025);
      mp.setY(i, mp.getY(i) + Math.cos(t * 0.3 + s * 1.3) * 0.0018);
    }
    mp.needsUpdate = true;
    const ap = this.ash.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < ap.count; i++) {
      const s = this.ashSeed[i] as number;
      let y = ap.getY(i) - 0.004 - Math.sin(t * 0.5 + s) * 0.002;
      if (y < 0) y = 6;
      ap.setY(i, y);
      ap.setX(i, ap.getX(i) + Math.sin(t * 0.25 + s) * 0.002);
    }
    ap.needsUpdate = true;
    for (const { grp, seed } of this.farEyes)
      grp.scale.setScalar(Math.sin(t * 0.7 + seed) > 0.96 ? 0 : 1);

    let i = 0;
    for (const s of this.sprites.values()) {
      if (s.dead) continue;
      const breathe = 1 + Math.sin(t * 1.7 + i * 2.1) * 0.02;
      s.plane.scale.y = breathe;
      if (s.recoil > 0) {
        s.recoil = Math.max(0, s.recoil - dt * 4);
        s.plane.position.x = Math.sin(s.recoil * 30) * 0.08 * s.recoil;
      } else s.plane.position.x = 0;
      if (s.unseen) {
        const target = s.revealTarget;
        s.reveal += (target - s.reveal) * Math.min(1, dt * 6);
        const shimmer = 0.06 + Math.sin(t * 13 + i) * 0.03;
        this.applyReveal(s);
        if (s.reveal < 0.95) s.plane.material.opacity = Math.max(s.plane.material.opacity, shimmer);
      }
      i++;
    }

    if (this.shakeAmt > 0) {
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 3);
      const a = this.shakeAmt * 0.12;
      this.camera.position.set(
        this.basePos.x + (Math.random() - 0.5) * a,
        this.basePos.y + (Math.random() - 0.5) * a,
        this.basePos.z,
      );
    } else this.camera.position.copy(this.basePos);
    this.camera.lookAt(this.lookAt);
    this.post.setTime(t);
  }

  render(): void {
    this.post.composer.render();
  }

  dispose(): void {
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

export { sleep };
