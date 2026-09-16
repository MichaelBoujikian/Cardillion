/**
 * DOM overlay for a fight: the hand (drag-to-target, or click card then click target), the
 * HUD (HP, Block, Charge, crumbs, piles, end turn), enemy labels projected from the 3D scene
 * (intent, HP bar, statuses, hit box), number pops, screen-hit feedback and the won/lost
 * overlay. It displays state it is given and reports the player's intent; it never decides
 * rules.
 */
import { cardDef } from '@content/cards';
import { enemyDef } from '@content/enemies';
import { formOf, isUpgraded } from '@engine/combat';
import type { CombatState, EnemyInstance } from '@engine/types';
import type { BattleScene } from '@render/battle/scene';
import type { CardFaces } from './card-faces';

export interface UIHandlers {
  onPlay(uid: string, target?: string): void;
  onEndTurn(): void;
  /** The won/lost overlay's button. */
  onContinue(): void;
  /** A card is being held (dragged, selected or hovered) — or none. */
  onHold(uid: string | null): void;
}

export type PopKind = 'damage' | 'poison' | 'block' | 'status' | 'crumbs' | 'info' | 'heal';

const CSS = /* css */ `
.bui { position:absolute; inset:0; pointer-events:none; font-family: Georgia, 'Times New Roman', serif; color:#f3e7c9; user-select:none; }
.bui * { box-sizing:border-box; }
.bui.locked .card, .bui.locked .turn { pointer-events:none; filter:saturate(.8) brightness(.9); }

.hand { position:absolute; left:50%; bottom:-38px; transform:translateX(-50%); display:flex; pointer-events:auto; height:230px; align-items:flex-end; }
.card { width:150px; height:210px; border-radius:10px; margin:0 -14px; transform-origin:50% 120%; position:relative;
  transition: transform .18s ease, filter .18s ease, opacity .18s ease; box-shadow: 0 10px 24px rgba(0,0,0,.55), 0 0 0 1px rgba(0,0,0,.3);
  background-size:cover; cursor:grab; touch-action:none; }
.card.deal { animation: deal .35s ease-out; }
@keyframes deal { from { opacity:0; transform: translateY(120px) rotate(0deg); } }
.card:hover, .card.selected { transform: translateY(-64px) scale(1.18) rotate(0deg) !important; z-index:10; filter: drop-shadow(0 0 16px rgba(255,214,120,.55)); }
.card.selected { filter: drop-shadow(0 0 22px rgba(255,214,120,.9)); }
.card.unaffordable { filter: grayscale(.6) brightness(.7); }
.card.unaffordable:hover { filter: grayscale(.6) brightness(.85); }
.card.dragging { position:fixed; left:0; top:0; margin:0; transform: translate(-50%,-50%) scale(1.05) !important; transition:none; z-index:50; pointer-events:none; cursor:grabbing; filter: drop-shadow(0 18px 30px rgba(0,0,0,.6)); }
.card.refused { animation: refuse .35s ease; }
@keyframes refuse { 0%,100% { translate:0 0; } 25% { translate:-8px 0; } 75% { translate:8px 0; } }

.player { position:absolute; left:26px; bottom:26px; display:flex; align-items:center; gap:14px; }
.portrait { width:72px; height:72px; border-radius:50%; background: radial-gradient(circle at 35% 35%, #fff2b8, #f2b200 70%, #a06f00);
  box-shadow: 0 0 0 4px #4a3418, 0 0 28px rgba(255,190,80,.5); display:grid; place-items:center; font-size:34px; }
.bars { display:flex; flex-direction:column; gap:8px; }
.hp { width:240px; height:22px; border-radius:11px; background:#2a1a1a; box-shadow: inset 0 0 0 2px #4a3418; overflow:hidden; position:relative; }
.hp > i { display:block; height:100%; width:100%; background: linear-gradient(#ff8a7a, #c8322b); transition: width .3s ease; }
.hp > b { position:absolute; inset:0; display:grid; place-items:center; font-size:14px; text-shadow: 0 1px 2px #000; }
.hp > u { position:absolute; right:-6px; top:-8px; width:34px; height:34px; border-radius:50%; background:#5d7fa8; border:2px solid #cfe1ff; display:grid; place-items:center; font: bold 15px Georgia, serif; text-decoration:none; color:#fff; box-shadow: 0 2px 6px rgba(0,0,0,.6); transform:scale(0); transition: transform .2s ease; }
.hp > u.on { transform:scale(1); }
.row { display:flex; gap:6px; align-items:center; font-size:14px; }
.charge i { width:22px; height:22px; border-radius:50%; background: radial-gradient(circle at 35% 35%, #fff6c2, #f2b200); box-shadow: 0 0 10px rgba(255,200,60,.9), 0 0 0 2px #a06f00; transition: background .2s ease, box-shadow .2s ease; }
.charge i.spent { background:#3a3020; box-shadow: 0 0 0 2px #4a3418; }
.statuses span { padding:2px 8px; border-radius:6px; font-size:12px; background:rgba(10,8,14,.7); border:1px solid rgba(255,255,255,.15); }
.statuses .poison { color:#9be37a; border-color:rgba(155,227,122,.5); }
.statuses .weak { color:#c9b3ff; border-color:rgba(201,179,255,.5); }

.crumbs { position:absolute; left:26px; top:22px; font-size:18px; letter-spacing:.04em; text-shadow: 0 1px 2px #000; }
.crumbs b { color:#ffd27a; }
.habitat { position:absolute; left:26px; top:52px; font-size:13px; color:#9be37a; text-shadow: 0 1px 2px #000; opacity:.9; }
.habitat b { color:#c6ff9e; letter-spacing:.06em; }
.topright { position:absolute; top:18px; right:26px; text-align:right; font-size:12px; letter-spacing:.12em; text-transform:uppercase; opacity:.7; line-height:1.7; }
.topright b { opacity:1; }
.turn { position:absolute; right:26px; bottom:34px; pointer-events:auto; padding:10px 22px; border-radius:8px;
  background: linear-gradient(#6b4a2a, #3a2412); color:#f3e7c9; border:2px solid #b8862b; font: 16px Georgia, serif; letter-spacing:.06em; cursor:pointer;
  box-shadow: 0 6px 18px rgba(0,0,0,.6); }
.turn:hover { filter:brightness(1.15); }
.piles { position:absolute; right:26px; bottom:96px; font-size:13px; opacity:.85; text-align:right; line-height:1.5; }

.enemy { position:absolute; left:0; top:0; }
.enemy-label { position:absolute; transform:translate(-50%, -100%); text-align:center; white-space:nowrap; }
.intent { display:inline-block; padding:3px 10px; border-radius:6px; background:rgba(10,8,14,.75); border:1px solid rgba(255,170,80,.45); color:#ffb86b; font-size:15px; letter-spacing:.05em; transition: transform .15s ease; }
.intent.acting { transform: scale(1.25); background:rgba(90,20,14,.9); }
.enemy-hp { position:absolute; transform:translate(-50%, 0); width:130px; text-align:center; }
.enemy-hp > div { height:9px; border-radius:5px; background:rgba(10,8,14,.8); border:1px solid rgba(0,0,0,.6); overflow:hidden; position:relative; }
.enemy-hp > div > i { display:block; height:100%; background: linear-gradient(#b8322b, #7a1522); transition: width .25s ease; }
.enemy-hp > b { display:block; font-size:11px; opacity:.85; margin-top:2px; }
.enemy-hp .statuses { justify-content:center; margin-top:3px; }
.enemy-hp .blk { color:#cfe1ff; border-color:rgba(207,225,255,.5); }
.enemy-hit { position:absolute; border-radius:12px; pointer-events:none; }
.bui.targeting .enemy-hit { pointer-events:auto; cursor:crosshair; }
.enemy-hit.over, .bui.targeting .enemy-hit:hover { box-shadow: 0 0 0 3px rgba(255,214,120,.9), 0 0 30px rgba(255,170,80,.5); background: rgba(255,200,80,.08); }
.enemy-hit.forbidden.over { box-shadow: 0 0 0 3px rgba(255,80,80,.8); background: rgba(255,60,60,.08); cursor:not-allowed; }

.pop { position:absolute; transform:translate(-50%,-50%); font-size:34px; font-weight:bold; color:#fff1c2; text-shadow: 0 0 12px #ff9a3c, 0 2px 0 #4a1a10; animation: pop .95s ease-out forwards; white-space:nowrap; }
.pop.poison { color:#b7ff9a; text-shadow: 0 0 12px #3fbf4a, 0 2px 0 #123; }
.pop.block { color:#cfe1ff; text-shadow: 0 0 12px #5d7fa8, 0 2px 0 #123; font-size:26px; }
.pop.status { color:#d9c7ff; text-shadow: 0 0 10px #8a6bff, 0 2px 0 #123; font-size:22px; }
.pop.crumbs { color:#ffd27a; text-shadow: 0 0 12px #a06f00, 0 2px 0 #4a1a10; font-size:24px; }
.pop.heal { color:#9be37a; font-size:26px; }
.pop.info { color:#f3e7c9; font-size:20px; text-shadow: 0 1px 2px #000; }
@keyframes pop { 0% { opacity:0; transform:translate(-50%,-30%) scale(.6);} 15% { opacity:1; transform:translate(-50%,-60%) scale(1.15);} 100% { opacity:0; transform:translate(-50%,-140%) scale(1);} }

.claw { position:absolute; inset:0; opacity:0; background:
  linear-gradient(115deg, transparent 38%, rgba(120,0,10,.55) 39%, transparent 41%, transparent 47%, rgba(120,0,10,.5) 48%, transparent 50%, transparent 56%, rgba(120,0,10,.45) 57%, transparent 59%);
  mix-blend-mode:multiply; }
.claw.on { animation: claw .55s ease-out; }
@keyframes claw { 0% { opacity:0; transform:scale(1.1);} 20% { opacity:1;} 100% { opacity:0; transform:scale(1);} }
.redveil { position:absolute; inset:0; opacity:0; background: radial-gradient(ellipse at center, transparent 45%, rgba(160,10,20,.7)); }
.redveil.on { animation: veil .5s ease-out; }
@keyframes veil { 0% { opacity:0;} 25% { opacity:1;} 100% { opacity:0;} }
.shell { position:absolute; inset:0; opacity:0; background: radial-gradient(ellipse at 50% 100%, rgba(120,170,255,.55), transparent 55%); }
.shell.on { animation: veil .45s ease-out; }

.toast { position:absolute; left:50%; bottom:250px; transform:translateX(-50%); padding:6px 14px; border-radius:8px; background:rgba(10,8,14,.85); border:1px solid rgba(255,214,120,.4); font-size:14px; opacity:0; transition: opacity .2s ease; }
.toast.on { opacity:1; }

.overlay { position:absolute; inset:0; display:grid; place-items:center; background: rgba(6,5,10,.55); opacity:0; pointer-events:none; transition: opacity .4s ease; }
.overlay.on { opacity:1; pointer-events:auto; }
.overlay .box { text-align:center; padding:36px 48px; border-radius:14px; background: linear-gradient(#2a2418, #14100c); border:2px solid #b8862b; box-shadow: 0 20px 60px rgba(0,0,0,.7); }
.overlay h1 { margin:0 0 8px; font-weight:600; letter-spacing:.12em; font-size:34px; }
.overlay h1.won { color:#ffd27a; } .overlay h1.lost { color:#ff8a7a; }
.overlay p { margin:0 0 20px; opacity:.85; }
.overlay button { pointer-events:auto; padding:10px 24px; border-radius:8px; background: linear-gradient(#6b4a2a, #3a2412); color:#f3e7c9; border:2px solid #b8862b; font: 16px Georgia, serif; letter-spacing:.06em; cursor:pointer; }
`;

interface EnemyEls {
  root: HTMLElement;
  label: HTMLElement;
  intent: HTMLElement;
  hpWrap: HTMLElement;
  hpBar: HTMLElement;
  hpText: HTMLElement;
  statuses: HTMLElement;
  hit: HTMLElement;
  hp: number;
  maxHp: number;
  block: number;
  poison: number;
  weak: number;
}

/** Human-readable intent for a label, honouring boss enrage. */
export function describeIntent(enemy: EnemyInstance): string {
  const def = enemyDef(enemy.def);
  const move = def.moves.find((m) => m.id === enemy.intent);
  if (!move) return '';
  const enraged =
    enemy.enraged ||
    (def.enrage !== undefined && enemy.hp <= enemy.maxHp * def.enrage.atHpFraction);
  const bonus = enraged && def.enrage ? def.enrage.bonusDamage : 0;
  const parts: string[] = [];
  for (const e of move.effects) {
    switch (e.kind) {
      case 'attack':
        parts.push(`⚔ ${e.amount + bonus}${e.times && e.times > 1 ? `×${e.times}` : ''}`);
        break;
      case 'block':
        parts.push(`🛡 ${e.amount}`);
        break;
      case 'apply':
        parts.push(e.status === 'weak' ? `Weak ${e.amount}` : `☠ ${e.amount}`);
        break;
      case 'cobweb':
        parts.push(`🕸 ${e.count}`);
        break;
      case 'pilfer':
        parts.push(`🍞 ${e.amount}`);
        break;
      case 'summon':
        parts.push('Summon');
        break;
    }
  }
  return parts.join('  ');
}

export class BattleUI {
  readonly el: HTMLElement;
  private readonly scene: BattleScene;
  private readonly faces: CardFaces;
  private readonly handlers: UIHandlers;
  private readonly hand: HTMLElement;
  private readonly labels: HTMLElement;
  private readonly pops: HTMLElement;
  private readonly enemies = new Map<string, EnemyEls>();
  private readonly cards = new Map<
    string,
    { el: HTMLElement; face: HTMLCanvasElement; targeting: string }
  >();
  private selected: string | null = null;
  private state: CombatState | null = null;
  private readonly q: (sel: string) => HTMLElement;

  constructor(root: HTMLElement, faces: CardFaces, scene: BattleScene, handlers: UIHandlers) {
    this.scene = scene;
    this.faces = faces;
    this.handlers = handlers;
    const style = document.createElement('style');
    style.textContent = CSS;
    root.appendChild(style);
    this.el = document.createElement('div');
    this.el.className = 'bui';
    this.el.innerHTML = `
      <div class="claw"></div><div class="redveil"></div><div class="shell"></div>
      <div class="labels"></div>
      <div class="crumbs">🍞 <b class="crumbs-n">0</b> crumbs</div>
      <div class="habitat"></div>
      <div class="topright">Cardillion · <b class="turn-n">turn 1</b><br>seed <b class="seed">—</b></div>
      <div class="player">
        <div class="portrait">☀</div>
        <div class="bars">
          <div class="hp"><i></i><b class="hp-t">60 / 60</b><u class="blk-t">0</u></div>
          <div class="row charge"></div>
          <div class="row statuses player-statuses"></div>
        </div>
      </div>
      <div class="piles"></div>
      <button class="turn">END TURN</button>
      <div class="hand"></div>
      <div class="pops"></div>
      <div class="toast"></div>
      <div class="overlay"><div class="box"><h1></h1><p></p><button class="again">CONTINUE</button></div></div>
    `;
    root.appendChild(this.el);
    this.q = (sel) => {
      const e = this.el.querySelector<HTMLElement>(sel);
      if (!e) throw new Error(`missing ${sel}`);
      return e;
    };
    this.hand = this.q('.hand');
    this.labels = this.q('.labels');
    this.pops = this.q('.pops');
    this.q('.turn').addEventListener('click', () => this.handlers.onEndTurn());
    this.q('.again').addEventListener('click', () => this.handlers.onContinue());
    // Clicking the table with a selected card: play untargeted cards, otherwise deselect.
    // Listens on the app root because the overlay itself is pointer-events:none.
    root.addEventListener('pointerdown', (ev) => {
      if (!this.selected) return;
      const t = ev.target as HTMLElement;
      if (t.closest('.card') || t.closest('.enemy-hit') || t.closest('button')) return;
      const card = this.cards.get(this.selected);
      if (card && card.targeting !== 'enemy' && ev.clientY < window.innerHeight * 0.68) {
        const uid = this.selected;
        this.select(null);
        this.handlers.onPlay(uid);
      } else this.select(null);
    });
    // Hovering over cards: pointer-events on the hand only.
    this.hand.style.pointerEvents = 'auto';
  }

  // ---------- full sync ----------

  setSeed(seed: string): void {
    this.q('.seed').textContent = seed;
  }

  render(state: CombatState): void {
    this.state = state;
    this.q('.turn-n').textContent = `turn ${state.turn}`;
    this.setPlayer(state.player.hp, state.player.maxHp);
    this.setPlayerBlock(state.player.statuses.block);
    this.setPlayerStatuses(state.player.statuses.poison, state.player.statuses.weak);
    this.setCharge(state.player.charge, state.player.chargePerTurn);
    this.setCrumbs(state.crumbs);
    this.setPiles(state.draw.length, state.discard.length, state.exhausted.length);
    this.syncEnemies(state);
    this.syncHand(state);
  }

  private syncEnemies(state: CombatState): void {
    const keep = new Set(state.enemies.map((e) => e.uid));
    for (const [uid, els] of this.enemies) {
      if (!keep.has(uid)) {
        els.root.remove();
        this.enemies.delete(uid);
      }
    }
    for (const enemy of state.enemies) {
      const els = this.enemies.get(enemy.uid) ?? this.addEnemy(enemy);
      els.hp = enemy.hp;
      els.maxHp = enemy.maxHp;
      els.block = enemy.statuses.block;
      els.poison = enemy.statuses.poison;
      els.weak = enemy.statuses.weak;
      this.paintEnemy(enemy.uid);
      els.intent.textContent = describeIntent(enemy);
      els.root.style.display = enemy.hp > 0 ? '' : 'none';
    }
  }

  addEnemy(enemy: EnemyInstance): EnemyEls {
    const root = document.createElement('div');
    root.className = 'enemy';
    root.dataset['uid'] = enemy.uid;
    root.innerHTML = `
      <div class="enemy-label"><span class="intent"></span></div>
      <div class="enemy-hp"><div><i></i></div><b></b><div class="row statuses"></div></div>
      <div class="enemy-hit"></div>`;
    this.labels.appendChild(root);
    const hit = root.querySelector<HTMLElement>('.enemy-hit') as HTMLElement;
    hit.addEventListener('pointerdown', (ev) => {
      if (!this.selected) return;
      ev.stopPropagation();
      const uid = this.selected;
      this.select(null);
      this.handlers.onPlay(uid, enemy.uid);
    });
    const els: EnemyEls = {
      root,
      label: root.querySelector('.enemy-label') as HTMLElement,
      intent: root.querySelector('.intent') as HTMLElement,
      hpWrap: root.querySelector('.enemy-hp') as HTMLElement,
      hpBar: root.querySelector('.enemy-hp i') as HTMLElement,
      hpText: root.querySelector('.enemy-hp b') as HTMLElement,
      statuses: root.querySelector('.enemy-hp .statuses') as HTMLElement,
      hit,
      hp: enemy.hp,
      maxHp: enemy.maxHp,
      block: enemy.statuses.block,
      poison: enemy.statuses.poison,
      weak: enemy.statuses.weak,
    };
    this.enemies.set(enemy.uid, els);
    els.intent.textContent = describeIntent(enemy);
    this.paintEnemy(enemy.uid);
    return els;
  }

  private paintEnemy(uid: string): void {
    const e = this.enemies.get(uid);
    if (!e) return;
    e.hpBar.style.width = `${(Math.max(0, e.hp) / e.maxHp) * 100}%`;
    e.hpText.textContent = `${Math.max(0, e.hp)} / ${e.maxHp}`;
    const chips: string[] = [];
    if (e.block > 0) chips.push(`<span class="blk">🛡 ${e.block}</span>`);
    if (e.poison > 0) chips.push(`<span class="poison">☠ ${e.poison}</span>`);
    if (e.weak > 0) chips.push(`<span class="weak">Weak ${e.weak}</span>`);
    e.statuses.innerHTML = chips.join('');
  }

  private faceFor(state: CombatState, uid: string): HTMLCanvasElement {
    const card = [...state.hand, ...state.draw, ...state.discard, ...state.exhausted].find(
      (c) => c.uid === uid,
    );
    if (!card) throw new Error(`no card ${uid}`);
    return this.faces.face(card.def, isUpgraded(state, card));
  }

  private syncHand(state: CombatState): void {
    const keep = new Set(state.hand.map((c) => c.uid));
    for (const [uid, entry] of this.cards) {
      if (!keep.has(uid)) {
        entry.el.remove();
        this.cards.delete(uid);
      }
    }
    if (this.selected && !keep.has(this.selected)) this.select(null);
    const n = state.hand.length;
    state.hand.forEach((card, i) => {
      let entry = this.cards.get(card.uid);
      const def = cardDef(card.def);
      if (!entry) {
        const face = this.faceFor(state, card.uid);
        const el = document.createElement('div');
        el.className = 'card deal';
        el.dataset['uid'] = card.uid;
        el.style.backgroundImage = `url(${face.toDataURL('image/png')})`;
        this.bindCard(el, card.uid);
        entry = { el, face, targeting: def.targeting };
        this.cards.set(card.uid, entry);
      }
      this.hand.appendChild(entry.el);
      const a = (i - (n - 1) / 2) * Math.min(6, 30 / Math.max(n, 1));
      entry.el.style.transform = `rotate(${a}deg) translateY(${Math.abs(a) * 1.4}px)`;
      const affordable = formOf(state, card).cost <= state.player.charge && !def.unplayable;
      entry.el.classList.toggle('unaffordable', !affordable);
    });
  }

  // ---------- hand interaction ----------

  private bindCard(el: HTMLElement, uid: string): void {
    let startX = 0;
    let startY = 0;
    let dragging = false;
    let over: HTMLElement | null = null;
    const setOver = (h: HTMLElement | null) => {
      if (over && over !== h) over.classList.remove('over');
      over = h;
      if (over) over.classList.add('over');
    };
    el.addEventListener('pointerenter', () => {
      if (!this.selected) this.handlers.onHold(uid);
    });
    el.addEventListener('pointerleave', () => {
      if (!this.selected && !dragging) this.handlers.onHold(null);
    });
    el.addEventListener('pointerdown', (ev) => {
      ev.stopPropagation();
      startX = ev.clientX;
      startY = ev.clientY;
      dragging = false;
      el.setPointerCapture(ev.pointerId);
    });
    el.addEventListener('pointermove', (ev) => {
      if (!el.hasPointerCapture(ev.pointerId)) return;
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 8) {
        dragging = true;
        this.select(null);
        el.classList.add('dragging');
        this.el.classList.add('targeting');
        this.handlers.onHold(uid);
      }
      if (!dragging) return;
      el.style.left = `${ev.clientX}px`;
      el.style.top = `${ev.clientY}px`;
      const entry = this.cards.get(uid);
      if (entry?.targeting === 'enemy') {
        const under = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
        setOver(under?.closest('.enemy-hit') as HTMLElement | null);
      }
    });
    const finish = (ev: PointerEvent) => {
      if (!el.hasPointerCapture(ev.pointerId)) return;
      el.releasePointerCapture(ev.pointerId);
      if (!dragging) {
        // A click: toggle selection.
        this.select(this.selected === uid ? null : uid);
        return;
      }
      dragging = false;
      el.classList.remove('dragging');
      el.style.left = '';
      el.style.top = '';
      this.el.classList.remove('targeting');
      const entry = this.cards.get(uid);
      const target = over?.closest('.enemy') as HTMLElement | null;
      setOver(null);
      this.handlers.onHold(null);
      if (!entry) return;
      if (entry.targeting === 'enemy') {
        const tUid = target?.dataset['uid'];
        if (tUid) this.handlers.onPlay(uid, tUid);
      } else if (ev.clientY < window.innerHeight * 0.68) {
        this.handlers.onPlay(uid);
      }
    };
    el.addEventListener('pointerup', finish);
    el.addEventListener('pointercancel', finish);
  }

  private select(uid: string | null): void {
    if (this.selected) this.cards.get(this.selected)?.el.classList.remove('selected');
    this.selected = uid;
    if (uid) this.cards.get(uid)?.el.classList.add('selected');
    this.el.classList.toggle(
      'targeting',
      uid !== null && this.cards.get(uid)?.targeting === 'enemy',
    );
    this.handlers.onHold(uid);
  }

  /** Mark which enemies a held card may target (Unseen enemies for non-Cats). */
  setForbiddenTargets(uids: string[]): void {
    for (const [uid, e] of this.enemies) e.hit.classList.toggle('forbidden', uids.includes(uid));
  }

  refuse(uid: string | null, reason: string): void {
    if (uid) {
      const el = this.cards.get(uid)?.el;
      if (el) {
        el.classList.remove('refused');
        void el.offsetWidth;
        el.classList.add('refused');
      }
    }
    const toast = this.q('.toast');
    toast.textContent = reason;
    toast.classList.add('on');
    setTimeout(() => toast.classList.remove('on'), 1400);
  }

  /** The card's face and current screen centre, for the 3D flight; removes it from the hand. */
  takeCard(uid: string): { face: HTMLCanvasElement; x: number; y: number } | null {
    const entry = this.cards.get(uid);
    if (!entry) return null;
    const r = entry.el.getBoundingClientRect();
    entry.el.remove();
    this.cards.delete(uid);
    if (this.selected === uid) this.select(null);
    return { face: entry.face, x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  setInputEnabled(on: boolean): void {
    this.el.classList.toggle('locked', !on);
    if (!on) this.select(null);
  }

  // ---------- progressive updates ----------

  setPlayer(hp: number, maxHp: number): void {
    this.q('.hp > i').style.width = `${(Math.max(0, hp) / maxHp) * 100}%`;
    this.q('.hp-t').textContent = `${Math.max(0, hp)} / ${maxHp}`;
  }

  setPlayerBlock(block: number): void {
    const b = this.q('.blk-t');
    b.textContent = String(block);
    b.classList.toggle('on', block > 0);
  }

  setPlayerStatuses(poison: number, weak: number): void {
    const chips: string[] = [];
    if (poison > 0) chips.push(`<span class="poison">☠ Poison ${poison}</span>`);
    if (weak > 0) chips.push(`<span class="weak">Weak ${weak}</span>`);
    this.q('.player-statuses').innerHTML = chips.join('');
  }

  setCharge(charge: number, max: number): void {
    const pips = Math.max(max, charge);
    this.q('.charge').innerHTML =
      Array.from({ length: pips }, (_, i) => `<i class="${i < charge ? '' : 'spent'}"></i>`).join(
        '',
      ) + `<span>Charge</span>`;
  }

  setCrumbs(n: number): void {
    this.q('.crumbs-n').textContent = String(n);
  }

  /** Name the fight's habitat and its effects under the crumbs (spec §8.9); null clears it. */
  setHabitat(habitat: { glyph: string; name: string; blurb: string } | null): void {
    this.q('.habitat').innerHTML = habitat
      ? `${habitat.glyph} <b>${habitat.name.toUpperCase()}</b> · ${habitat.blurb}`
      : '';
  }

  setPiles(draw: number, discard: number, exhausted: number): void {
    this.q('.piles').innerHTML =
      `Draw ${draw}<br>Discard ${discard}${exhausted ? `<br>Exhausted ${exhausted}` : ''}`;
  }

  setEnemyHp(uid: string, hp: number): void {
    const e = this.enemies.get(uid);
    if (!e) return;
    e.hp = hp;
    this.paintEnemy(uid);
  }

  setEnemyBlock(uid: string, block: number): void {
    const e = this.enemies.get(uid);
    if (!e) return;
    e.block = block;
    this.paintEnemy(uid);
  }

  setEnemyStatuses(uid: string, poison: number, weak: number): void {
    const e = this.enemies.get(uid);
    if (!e) return;
    e.poison = poison;
    e.weak = weak;
    this.paintEnemy(uid);
  }

  setEnemyIntent(uid: string, text: string): void {
    const e = this.enemies.get(uid);
    if (e) e.intent.textContent = text;
  }

  flashIntent(uid: string, on: boolean): void {
    this.enemies.get(uid)?.intent.classList.toggle('acting', on);
  }

  hideEnemy(uid: string): void {
    const e = this.enemies.get(uid);
    if (e) e.root.style.display = 'none';
  }

  showEnemy(uid: string): void {
    const e = this.enemies.get(uid);
    if (e) e.root.style.display = '';
  }

  pop(target: string, text: string, kind: PopKind = 'damage'): void {
    let x: number;
    let y: number;
    if (target === 'player') {
      const r = this.q('.player').getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top;
    } else {
      const a = this.scene.enemyAnchor(target, 'head');
      if (!a) return;
      x = a.x;
      y = a.y + 90;
    }
    const el = document.createElement('div');
    el.className = `pop ${kind}`;
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.pops.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  /** Screen feedback for a hit on the player: claws and a red veil, or a shell flash if fully blocked. */
  playerHit(blockedOnly: boolean): void {
    for (const sel of blockedOnly ? ['.shell'] : ['.claw', '.redveil']) {
      const el = this.q(sel);
      el.classList.remove('on');
      void el.offsetWidth;
      el.classList.add('on');
    }
  }

  showOverlay(kind: 'won' | 'lost', line: string, button = 'CONTINUE'): void {
    const o = this.q('.overlay');
    const h = this.q('.overlay h1');
    h.textContent = kind === 'won' ? 'VICTORY' : 'THE GARDEN FALLS';
    h.className = kind;
    this.q('.overlay p').textContent = line;
    this.q('.again').textContent = button;
    o.classList.add('on');
  }

  show(): void {
    this.el.hidden = false;
  }

  hide(): void {
    this.el.hidden = true;
    this.select(null);
  }

  hideOverlay(): void {
    this.q('.overlay').classList.remove('on');
  }

  /** Reposition projected enemy labels and hit boxes. Call every frame. */
  update(): void {
    for (const [uid, e] of this.enemies) {
      const head = this.scene.enemyAnchor(uid, 'head');
      const feet = this.scene.enemyAnchor(uid, 'feet');
      const rect = this.scene.enemyRect(uid);
      if (!head || !feet) continue;
      e.label.style.left = `${head.x}px`;
      e.label.style.top = `${head.y}px`;
      e.hpWrap.style.left = `${feet.x}px`;
      e.hpWrap.style.top = `${feet.y}px`;
      if (rect) {
        e.hit.style.left = `${rect.x}px`;
        e.hit.style.top = `${rect.y}px`;
        e.hit.style.width = `${rect.w}px`;
        e.hit.style.height = `${rect.h}px`;
      }
    }
  }

  get currentState(): CombatState | null {
    return this.state;
  }
}
