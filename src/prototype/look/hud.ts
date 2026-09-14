/**
 * DOM overlay for the look prototype: hand of cards, HP / Charge / crumbs, enemy intents and
 * HP bars projected from the 3D scene, and a damage number pop.
 */
import * as THREE from 'three';
import type { Enemy, LookArt } from './scene';
import { drawCardFace, type Bug } from './textures';

const CSS = /* css */ `
.look-hud { position:absolute; inset:0; pointer-events:none; font-family: Georgia, 'Times New Roman', serif; color:#f3e7c9; }
.look-hud * { box-sizing:border-box; }

.hand { position:absolute; left:50%; bottom:-38px; transform:translateX(-50%); display:flex; gap:-10px; pointer-events:auto; }
.hand .card { width:150px; height:210px; border-radius:10px; margin:0 -14px; transform-origin:50% 120%;
  transition: transform .18s ease, filter .18s ease; box-shadow: 0 10px 24px rgba(0,0,0,.55), 0 0 0 1px rgba(0,0,0,.3);
  background-size:cover; cursor:grab; }
.hand .card:hover { transform: translateY(-64px) scale(1.18) rotate(0deg) !important; z-index:10; filter: drop-shadow(0 0 16px rgba(255,214,120,.55)); }

.player { position:absolute; left:26px; bottom:26px; display:flex; align-items:center; gap:14px; }
.portrait { width:72px; height:72px; border-radius:50%; background: radial-gradient(circle at 35% 35%, #fff2b8, #f2b200 70%, #a06f00);
  box-shadow: 0 0 0 4px #4a3418, 0 0 28px rgba(255,190,80,.5); display:grid; place-items:center; font-size:34px; }
.bars { display:flex; flex-direction:column; gap:8px; }
.hp { width:240px; height:22px; border-radius:11px; background:#2a1a1a; box-shadow: inset 0 0 0 2px #4a3418; overflow:hidden; position:relative; }
.hp > i { display:block; height:100%; width:100%; background: linear-gradient(#ff8a7a, #c8322b); }
.hp > b { position:absolute; inset:0; display:grid; place-items:center; font-size:14px; text-shadow: 0 1px 2px #000; }
.charge { display:flex; gap:6px; align-items:center; font-size:14px; }
.charge i { width:22px; height:22px; border-radius:50%; background: radial-gradient(circle at 35% 35%, #fff6c2, #f2b200); box-shadow: 0 0 10px rgba(255,200,60,.9), 0 0 0 2px #a06f00; }
.charge i.spent { background:#3a3020; box-shadow: 0 0 0 2px #4a3418; }

.crumbs { position:absolute; left:26px; top:22px; font-size:18px; letter-spacing:.04em; text-shadow: 0 1px 2px #000; }
.crumbs b { color:#ffd27a; }
.turn { position:absolute; right:26px; bottom:34px; pointer-events:auto; padding:10px 22px; border-radius:8px;
  background: linear-gradient(#6b4a2a, #3a2412); color:#f3e7c9; border:2px solid #b8862b; font: 16px Georgia, serif; letter-spacing:.06em; cursor:pointer;
  box-shadow: 0 6px 18px rgba(0,0,0,.6); }
.turn:hover { filter:brightness(1.15); }
.deck { position:absolute; right:26px; bottom:96px; font-size:13px; opacity:.8; text-align:right; line-height:1.5; }

.enemy-label { position:absolute; transform:translate(-50%, -100%); text-align:center; white-space:nowrap; }
.intent { display:inline-block; padding:3px 10px; border-radius:6px; background:rgba(10,8,14,.75); border:1px solid rgba(255,170,80,.45); color:#ffb86b; font-size:15px; letter-spacing:.05em; }
.enemy-hp { position:absolute; transform:translate(-50%, 0); width:120px; height:9px; border-radius:5px; background:rgba(10,8,14,.8); border:1px solid rgba(0,0,0,.6); overflow:hidden; }
.enemy-hp > i { display:block; height:100%; background: linear-gradient(#b8322b, #7a1522); transition: width .25s ease; }
.enemy-hp > b { position:absolute; left:0; right:0; top:10px; font-size:11px; text-align:center; opacity:.85; }

.dmg { position:absolute; transform:translate(-50%,-50%); font-size:34px; font-weight:bold; color:#fff1c2; text-shadow: 0 0 12px #ff9a3c, 0 2px 0 #4a1a10;
  animation: dmg .9s ease-out forwards; }
@keyframes dmg { 0% { opacity:0; transform:translate(-50%,-30%) scale(.6);} 15% { opacity:1; transform:translate(-50%,-60%) scale(1.15);} 100% { opacity:0; transform:translate(-50%,-140%) scale(1);} }

.title { position:absolute; top:18px; right:26px; text-align:right; opacity:.55; font-size:12px; letter-spacing:.12em; text-transform:uppercase; }
`;

export interface Hud {
  el: HTMLElement;
  /** Reposition projected labels. Call every frame after the camera is final. */
  update(camera: THREE.Camera, enemies: Enemy[], width: number, height: number): void;
  /** Show a damage pop on an enemy and shrink its HP bar. */
  hit(enemy: Enemy, amount: number): void;
}

export function mountHud(root: HTMLElement, enemies: Enemy[], art: LookArt = {}): Hud {
  const style = document.createElement('style');
  style.textContent = CSS;
  root.appendChild(style);

  const el = document.createElement('div');
  el.className = 'look-hud';
  el.innerHTML = `
    <div class="title">Cardillion · look prototype (M1)</div>
    <div class="crumbs">🍞 <b>25</b> crumbs</div>
    <div class="player">
      <div class="portrait">☀</div>
      <div class="bars">
        <div class="hp"><i style="width:100%"></i><b>60 / 60</b></div>
        <div class="charge"><i></i><i></i><i></i><span>Charge</span></div>
      </div>
    </div>
    <div class="deck">Draw 5<br>Discard 0</div>
    <button class="turn">END TURN</button>
    <div class="hand"></div>
    <div class="labels"></div>
  `;
  root.appendChild(el);

  const hand = el.querySelector<HTMLElement>('.hand');
  const labels = el.querySelector<HTMLElement>('.labels');
  if (!hand || !labels) throw new Error('hud markup');

  const bugs: Bug[] = ['wormillion', 'roly-poly', 'wormillion', 'ladybug', 'cat'];
  bugs.forEach((bug, i) => {
    const c = document.createElement('div');
    c.className = 'card';
    const face = drawCardFace(bug, bug === 'wormillion' ? art.wormillion : null);
    c.style.backgroundImage = `url(${face.toDataURL('image/png')})`;
    const a = (i - (bugs.length - 1) / 2) * 6;
    c.style.transform = `rotate(${a}deg) translateY(${Math.abs(a) * 1.4}px)`;
    hand.appendChild(c);
  });

  const labelEls = enemies.map(() => {
    const intent = document.createElement('div');
    intent.className = 'enemy-label';
    intent.innerHTML = `<span class="intent"></span>`;
    const hp = document.createElement('div');
    hp.className = 'enemy-hp';
    hp.innerHTML = `<i></i><b></b>`;
    labels.append(intent, hp);
    return { intent, hp };
  });

  const v = new THREE.Vector3();
  const project = (p: THREE.Vector3, camera: THREE.Camera, w: number, h: number) => {
    v.copy(p).project(camera);
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
  };

  return {
    el,
    update(camera, list, w, h) {
      list.forEach((e, i) => {
        const L = labelEls[i];
        if (!L) return;
        const head = project(e.headAnchor, camera, w, h);
        const feet = project(e.feetAnchor, camera, w, h);
        L.intent.style.left = `${head.x}px`;
        L.intent.style.top = `${head.y}px`;
        const s = L.intent.firstElementChild as HTMLElement;
        s.textContent = e.intent;
        L.hp.style.left = `${feet.x}px`;
        L.hp.style.top = `${feet.y}px`;
        (L.hp.firstElementChild as HTMLElement).style.width = `${(e.hp / e.maxHp) * 100}%`;
        (L.hp.lastElementChild as HTMLElement).textContent = `${e.hp} / ${e.maxHp}`;
      });
    },
    hit(enemy, amount) {
      enemy.hp = Math.max(0, enemy.hp - amount);
      const i = enemies.indexOf(enemy);
      const L = labelEls[i];
      if (!L) return;
      const pop = document.createElement('div');
      pop.className = 'dmg';
      pop.textContent = `−${amount}`;
      pop.style.left = L.intent.style.left;
      pop.style.top = `calc(${L.intent.style.top} + 90px)`;
      labels.appendChild(pop);
      setTimeout(() => pop.remove(), 950);
      if (enemy.hp === 0) setTimeout(() => (enemy.hp = enemy.maxHp), 1200);
    },
  };
}
