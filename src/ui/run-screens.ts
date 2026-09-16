/**
 * The non-fight screens of a run: title, map, reward, shop, cocoon, result — plus the deck
 * list used by the map HUD and the shop's removal service. DOM over the battle canvas.
 */
import { PUPATION, cardDef } from '@content/cards';
import { HABITATS } from '@content/habitats';
import { FLAVORS } from '@content/trails';
import { TITLED_UNLOCKS, upgradeDef } from '@content/upgrades';
import { nodeAt, signposts, visibleNodes, type MapNode } from '@engine/map';
import {
  COCOON_HEAL_FRACTION,
  FORAGE_CRUMBS,
  canSeeGreebleMarker,
  type RunState,
} from '@engine/run';
import type { ArtCache } from '@render/battle/textures';
import type { CardFaces } from './card-faces';

export interface ScreenHandlers {
  onNewRun(seed: string | null): void;
  onTravel(nodeId: string): void;
  onTakeReward(card: string | null): void;
  onBuy(index: number): void;
  onRemove(uid: string): void;
  onBuyUnlock(index: number): void;
  onBuyUpgrade(index: number): void;
  onBuyWormillionaire(): void;
  onRest(): void;
  onForage(): void;
  onPupate(uid: string): void;
  onLeave(): void;
  onBackToTitle(): void;
}

const GLYPH: Record<string, string> = {
  start: '⌂',
  fight: '⚔',
  elite: '☠',
  shop: '🐌',
  cocoon: '❂',
  boss: '🐻',
  unknown: '?',
};

const CSS = /* css */ `
.screens { position:absolute; inset:0; pointer-events:none; font-family: Georgia, 'Times New Roman', serif; color:#f3e7c9; }
.screens * { box-sizing:border-box; }
.screen { position:absolute; inset:0; display:none; pointer-events:auto; }
.screen.on { display:block; }
.screen .panel { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); padding:32px 40px; border-radius:16px;
  background: linear-gradient(#2a2418, #14100c); border:2px solid #b8862b; box-shadow: 0 24px 70px rgba(0,0,0,.75); text-align:center; min-width:420px; }
.screen h1 { margin:0 0 6px; font-weight:600; letter-spacing:.14em; font-size:34px; }
.screen h2 { margin:0 0 14px; font-weight:400; font-size:16px; opacity:.8; }
.screen p { margin:0 0 16px; opacity:.85; line-height:1.5; }
.btn { display:inline-block; padding:10px 24px; border-radius:8px; background: linear-gradient(#6b4a2a, #3a2412); color:#f3e7c9; border:2px solid #b8862b;
  font: 16px Georgia, serif; letter-spacing:.06em; cursor:pointer; margin:6px; }
.btn:hover { filter:brightness(1.15); }
.btn.ghost { background:transparent; border-color:rgba(184,134,43,.5); }
.btn:disabled { opacity:.45; cursor:not-allowed; filter:none; }
.veil { position:absolute; inset:0; background: rgba(6,5,10,.6); }

/* title */
.title-screen .panel { background: transparent; border:none; box-shadow:none; }
.title-screen h1 { font-size:72px; letter-spacing:.22em; color:#ffd27a; text-shadow: 0 0 40px rgba(255,190,80,.35), 0 4px 0 #4a3418; }
.title-screen h2 { font-size:18px; letter-spacing:.08em; }
.title-screen input { width:260px; padding:8px 12px; border-radius:6px; border:1px solid rgba(184,134,43,.6); background:rgba(10,8,14,.7); color:#f3e7c9; font: 15px Georgia, serif; text-align:center; margin:6px; }

/* map */
.map-screen { background:#0b0d09; }
.map-screen .bg { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; opacity:.85; filter: saturate(.9); }
.map-screen .bg-fallback { position:absolute; inset:0; background: linear-gradient(#0a0910, #1d2a14 45%, #3d5a22); }
.map-screen svg { position:absolute; inset:0; width:100%; height:100%; }
.map-screen .trail { fill:none; stroke:rgba(255,235,190,.55); stroke-width:6; stroke-linecap:round; stroke-dasharray: 2 14; }
.map-screen .trail.dim { stroke:rgba(255,235,190,.18); }
.map-screen .node circle { fill:#2a2418; stroke:#b8862b; stroke-width:3; }
.map-screen .node text { font: 22px Georgia, serif; fill:#f3e7c9; text-anchor:middle; dominant-baseline:central; pointer-events:none; }
.map-screen .node.unknown circle { fill:#1a1712; stroke:rgba(184,134,43,.35); }
.map-screen .node.unknown text { fill:rgba(243,231,201,.45); }
.map-screen .node.visited circle { fill:#3a3020; stroke:rgba(184,134,43,.5); }
.map-screen .node.visited text { opacity:.55; }
.map-screen .node.reachable { cursor:pointer; }
.map-screen .node.reachable circle { stroke:#ffd27a; stroke-width:4; animation: pulse 1.4s ease-in-out infinite; }
.map-screen .node.reachable:hover circle { fill:#5a4020; }
.map-screen .node.here circle { fill:#f2b200; stroke:#fff2b8; }
.map-screen .node.here text { fill:#2a1a08; }
.map-screen .node.boss circle { fill:#1c0e12; stroke:#b8322b; stroke-width:4; }
.map-screen .node.elite circle { stroke:#d9534f; }
.map-screen .node .habitat { font-size:15px; fill:#9be37a; paint-order:stroke; stroke:#0b0d09; stroke-width:3px; }
@keyframes pulse { 0%,100% { stroke-opacity:1; } 50% { stroke-opacity:.35; } }
.map-screen .signpost { font: italic 15px Georgia, serif; fill:#ffd27a; text-anchor:middle; paint-order:stroke; stroke:#0b0d09; stroke-width:4px; pointer-events:none; }
.map-screen .signpost.blurb { font-size:12px; fill:#f3e7c9; opacity:.85; }
.map-hud { position:absolute; left:26px; top:22px; font-size:16px; line-height:1.9; text-shadow: 0 1px 3px #000; }
.map-hud b { color:#ffd27a; }
.map-hud .btn { margin-left:0; padding:6px 14px; font-size:14px; }
.map-legend { position:absolute; left:26px; bottom:22px; font-size:13px; opacity:.75; line-height:1.7; text-shadow: 0 1px 2px #000; }
.map-title { position:absolute; right:26px; top:18px; text-align:right; font-size:12px; letter-spacing:.12em; text-transform:uppercase; opacity:.7; line-height:1.8; }

/* cards in panels */
.cards { display:flex; gap:18px; justify-content:center; margin:14px 0 18px; }
.pick { width:180px; height:252px; border-radius:10px; background-size:cover; box-shadow: 0 10px 24px rgba(0,0,0,.6); cursor:pointer; position:relative; transition: transform .15s ease, filter .15s ease; }
.pick:hover { transform: translateY(-10px) scale(1.06); filter: drop-shadow(0 0 16px rgba(255,214,120,.6)); }
.pick.sold, .pick.poor { cursor:not-allowed; filter: grayscale(.7) brightness(.55); }
.pick.sold:hover, .pick.poor:hover { transform:none; }
.pick .price { position:absolute; left:50%; bottom:-14px; transform:translateX(-50%); padding:3px 12px; border-radius:12px; background:#14100c; border:1px solid #b8862b; color:#ffd27a; font-size:14px; white-space:nowrap; }
.pick .sold-tag { position:absolute; inset:0; display:grid; place-items:center; font-size:26px; letter-spacing:.2em; color:#ff8a7a; text-shadow: 0 2px 4px #000; }

/* painted stops (shop, cocoon): a full-bleed backdrop with the UI laid into the picture */
.stop { background:#0b0d09; }
.stop .bg { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
.stop .bg-fallback { position:absolute; inset:0; background: linear-gradient(90deg, #3d5a22, #1d2a14 45%, #0a0910); }
.stop .shade { position:absolute; inset:0; background: linear-gradient(90deg, rgba(6,5,10,0) 48%, rgba(6,5,10,.5) 72%); pointer-events:none; }
.stop-hud { position:absolute; left:26px; top:22px; font-size:16px; line-height:1.9; text-shadow: 0 1px 3px #000; padding:6px 14px; border-radius:10px; background:rgba(6,5,10,.45); }
.stop-hud b { color:#ffd27a; }
.stop-title { position:absolute; right:26px; top:18px; text-align:right; text-shadow: 0 2px 6px #000; }
.stop-title h1 { margin:0; font-size:30px; letter-spacing:.14em; }
.stop-title h2 { margin:2px 0 0; font-size:14px; opacity:.85; }

/* shop */
.shop-screen .snail { position:absolute; left:0; bottom:3%; height:32vh; filter: drop-shadow(0 10px 18px rgba(0,0,0,.75)); }
.shop-screen .counter { position:absolute; left:19%; bottom:9%; display:flex; gap:18px; }
.shop-screen .counter .pick { width:150px; height:210px; }
.shop-screen .wares { position:absolute; right:4%; top:17%; width:min(440px, 42vw); justify-content:flex-end; margin:0; }
.shop-screen .actions { position:absolute; right:26px; bottom:26px; text-align:right; }
.wares { display:flex; gap:10px; justify-content:center; flex-wrap:wrap; margin:0 0 6px; }
.ware { width:196px; text-align:left; padding:8px 10px; border-radius:10px; background:rgba(10,8,14,.55); border:1px solid rgba(184,134,43,.5); cursor:pointer; transition: transform .15s ease, filter .15s ease; }
.ware:hover { transform:translateY(-3px); filter: drop-shadow(0 0 12px rgba(255,214,120,.45)); border-color:#ffd27a; }
.ware b { display:block; color:#ffd27a; font-size:15px; }
.ware small { display:block; opacity:.85; font-size:12px; line-height:1.35; margin:3px 0 4px; }
.ware .tag { font-size:13px; color:#ffd27a; }
.ware.sold, .ware.poor { cursor:not-allowed; filter: grayscale(.7) brightness(.6); }
.ware.sold:hover, .ware.poor:hover { transform:none; border-color:rgba(184,134,43,.5); }
.ware.sold .tag { color:#ff8a7a; }
.discount { display:inline-block; margin-left:10px; padding:2px 8px; border-radius:10px; background:#5a3a10; color:#ffd27a; font-size:12px; letter-spacing:.06em; vertical-align:middle; }

/* cocoon */
.cocoon-screen .choices { position:absolute; right:6%; top:50%; transform:translateY(-50%); width:min(380px, 38vw); display:flex; flex-direction:column; gap:12px; }
.choice { text-align:left; padding:14px 18px; border-radius:12px; background:rgba(10,8,14,.74); border:2px solid rgba(184,134,43,.6); cursor:pointer; color:#f3e7c9; font-family:inherit; transition: transform .15s ease, filter .15s ease, border-color .15s ease; }
.choice:hover { transform:translateX(-6px); border-color:#ffd27a; filter: drop-shadow(0 0 14px rgba(255,214,120,.45)); }
.choice b { display:block; color:#ffd27a; font-size:18px; letter-spacing:.08em; }
.choice small { display:block; font-size:13px; opacity:.85; margin-top:3px; line-height:1.4; }
.choice:disabled { opacity:.45; cursor:not-allowed; }
.choice:disabled:hover { transform:none; filter:none; border-color:rgba(184,134,43,.6); }
.cocoon-screen .leave { position:absolute; right:26px; bottom:26px; }

/* map markers */
.map-screen .marker { pointer-events:none; }
.map-screen .marker.snail image { filter: drop-shadow(0 3px 6px rgba(0,0,0,.7)); }
.map-screen .marker.snail text { font: 28px Georgia, serif; text-anchor:middle; dominant-baseline:central; }
.map-screen .marker.greeble circle { fill:#ffb347; filter: drop-shadow(0 0 6px #ff9a3c); animation: blink 3.2s ease-in-out infinite; }
@keyframes blink { 0%,44%,52%,100% { opacity:1; } 48% { opacity:0; } }
.map-hud .who { font-size:12px; opacity:.85; margin-top:2px; max-width:260px; line-height:1.6; }
.map-hud .who span { display:inline-block; margin-right:10px; }

/* deck list */
.deck-list { position:absolute; inset:0; display:none; background:rgba(6,5,10,.85); overflow:auto; padding:40px; pointer-events:auto; }
.deck-list.on { display:block; }
.deck-list .grid { display:flex; flex-wrap:wrap; gap:14px; justify-content:center; max-width:1100px; margin:16px auto; }
.deck-list .pick { width:130px; height:182px; }
.deck-list h2 { text-align:center; }
.deck-list .close { position:absolute; right:26px; top:22px; }

/* result */
.result-screen h1.victory { color:#ffd27a; }
.result-screen h1.death { color:#ff8a7a; }
.reward-screen .note { color:#ffd27a; margin:0 0 8px; }
.result-screen .stats { display:inline-block; text-align:left; margin:0 0 12px; line-height:1.8; }
.result-screen code { color:#ffd27a; }
`;

export class RunScreens {
  readonly el: HTMLElement;
  private readonly faces: CardFaces;
  private readonly art: ArtCache;
  private readonly h: ScreenHandlers;
  private readonly screens: Record<string, HTMLElement> = {};
  private readonly deckList: HTMLElement;

  constructor(root: HTMLElement, faces: CardFaces, art: ArtCache, handlers: ScreenHandlers) {
    this.faces = faces;
    this.art = art;
    this.h = handlers;
    const style = document.createElement('style');
    style.textContent = CSS;
    root.appendChild(style);
    this.el = document.createElement('div');
    this.el.className = 'screens';
    root.appendChild(this.el);
    for (const name of ['title', 'map', 'reward', 'shop', 'cocoon', 'result']) {
      const s = document.createElement('div');
      s.className = `screen ${name}-screen`;
      this.el.appendChild(s);
      this.screens[name] = s;
    }
    this.deckList = document.createElement('div');
    this.deckList.className = 'deck-list';
    this.el.appendChild(this.deckList);
  }

  hideAll(): void {
    for (const s of Object.values(this.screens)) s.classList.remove('on');
    this.deckList.classList.remove('on');
  }

  private show(name: string, html: string): HTMLElement {
    this.hideAll();
    const s = this.screens[name] as HTMLElement;
    s.innerHTML = html;
    s.classList.add('on');
    return s;
  }

  // ---------- title ----------

  showTitle(seedHint: string | null): void {
    const s = this.show(
      'title',
      `<div class="veil"></div>
       <div class="panel">
         <h1>CARDILLION</h1>
         <h2>cyborg garden bugs versus the things in the thicket</h2>
         <p><input class="seed" placeholder="seed (optional)" value="${seedHint ?? ''}" spellcheck="false"></p>
         <button class="btn new">NEW RUN</button>
       </div>`,
    );
    const input = s.querySelector<HTMLInputElement>('.seed') as HTMLInputElement;
    const go = () => this.h.onNewRun(input.value.trim() || null);
    s.querySelector('.new')?.addEventListener('click', go);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') go();
    });
  }

  // ---------- map ----------

  showMap(run: RunState): void {
    const map = run.map;
    const here = nodeAt(map, run.position);
    const visible = visibleNodes(map, run.position, run.visited);
    const reachable = new Set(here.next.map((e) => e.id));
    // A habitat can only be smelled one step ahead, or remembered (spec §8.9).
    const smells = (id: string) =>
      reachable.has(id) || id === run.position || run.visited.includes(id);
    const bg = this.art.get('bg-map');
    const W = 1000;
    const H = 1000;
    const px = (n: MapNode) => ({ x: 120 + n.x * (W - 240), y: H - 60 - n.y * (H - 120) });

    // Trails as dotted curves through their nodes.
    const trailPaths = map.trails
      .map((t, i) => {
        const pts = [map.start, ...t.nodes, map.boss].map((id) => px(nodeAt(map, id)));
        let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
        for (let k = 1; k < pts.length; k++) {
          const a = pts[k - 1]!;
          const b = pts[k]!;
          const cx = (a.x + b.x) / 2 + (k % 2 ? 18 : -18);
          d += ` Q ${cx} ${(a.y + b.y) / 2} ${b.x} ${b.y}`;
        }
        const dim = here.trails.length === 1 && here.id !== map.start && !here.trails.includes(i);
        return `<path class="trail${dim ? ' dim' : ''}" d="${d}"/>`;
      })
      .join('');

    const nodesSvg = Object.values(map.nodes)
      .map((n) => {
        const p = px(n);
        const known = visible.has(n.id);
        const cls = [
          'node',
          n.type,
          known ? '' : 'unknown',
          run.visited.includes(n.id) && n.id !== run.position ? 'visited' : '',
          reachable.has(n.id) ? 'reachable' : '',
          n.id === run.position ? 'here' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const r = n.type === 'boss' ? 30 : known ? 22 : 12;
        const glyph = n.id === run.position ? '☀' : known ? (GLYPH[n.type] ?? '?') : '';
        const habitat = n.habitat && smells(n.id) ? HABITATS[n.habitat] : null;
        const label = (known ? n.type : 'unknown') + (habitat ? ` · ${habitat.name}` : '');
        const badge = habitat
          ? `<text class="habitat" x="${p.x + 19}" y="${p.y - 17}">${habitat.glyph}</text>`
          : '';
        return `<g class="${cls}" data-id="${n.id}"><title>${label}</title><circle cx="${p.x}" cy="${p.y}" r="${r}"/><text x="${p.x}" y="${p.y + 1}">${glyph}</text>${badge}</g>`;
      })
      .join('');

    // Signposts on the edges leading out of the current node.
    const posts = signposts(map, run.position)
      .map((sp) => {
        const a = px(here);
        const b = px(nodeAt(map, sp.to));
        const fl = FLAVORS[sp.flavor];
        const x = (a.x + b.x) / 2 + (b.x - a.x) * 0.15;
        const y = (a.y + b.y) / 2 - 12;
        return `<text class="signpost" x="${x}" y="${y}">${fl.name}</text><text class="signpost blurb" x="${x}" y="${y + 18}">${fl.blurb}</text>`;
      })
      .join('');

    // Markers: the Snail is always shown; the Greeble only to a Cat owner (spec §8.5, §8.6).
    const snailArt = this.art.get('npc-snail');
    let markers = '';
    if (run.snailNode) {
      const p = px(nodeAt(map, run.snailNode));
      markers += snailArt
        ? `<g class="marker snail"><image href="${snailArt.src}" x="${p.x + 14}" y="${p.y - 58}" width="56" height="56"/></g>`
        : `<g class="marker snail"><text x="${p.x + 30}" y="${p.y - 30}">🐌</text></g>`;
    }
    const seesGreeble = canSeeGreebleMarker(run);
    if (seesGreeble) {
      const p = px(nodeAt(map, run.greebleNode));
      markers += `<g class="marker greeble"><circle cx="${p.x - 9}" cy="${p.y - 34}" r="4"/><circle cx="${p.x + 9}" cy="${p.y - 34}" r="4"/></g>`;
    }
    const owned = [
      ...run.unlocks.map((b) => TITLED_UNLOCKS[b]),
      ...run.upgrades.map((u) => upgradeDef(u).name),
    ];

    const s = this.show(
      'map',
      `${bg ? `<img class="bg" src="${bg.src}" alt="">` : '<div class="bg-fallback"></div>'}
       <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${trailPaths}${nodesSvg}${markers}${posts}</svg>
       <div class="map-hud">
         ❤ <b>${run.hp} / ${run.maxHp}</b><br>
         🍞 <b>${run.crumbs}</b> crumbs<br>
         <button class="btn ghost deck">Deck · ${run.deck.length}</button>
         ${owned.length ? `<div class="who">${owned.map((n) => `<span>✦ ${n}</span>`).join('')}</div>` : ''}
       </div>
       <div class="map-legend">⚔ fight · ☠ elite · 🐌 shop · ❂ cocoon · 🐻 the Bear · ? unknown · <span style="color:#9be37a">⛰ ❀ ☀ ◐</span> habitat, smelled a step ahead${
         run.snailNode ? ' · 🐌 the Snail wanders' : ''
       }${seesGreeble ? ' · 👀 the Greeble' : ''}</div>
       <div class="map-title">Cardillion · the garden<br>seed <b>${run.seed}</b></div>`,
    );
    for (const g of s.querySelectorAll<SVGGElement>('.node.reachable')) {
      g.addEventListener('click', () => this.h.onTravel(g.dataset['id'] as string));
    }
    s.querySelector('.deck')?.addEventListener('click', () => this.showDeck(run, null));
  }

  /**
   * The deck as a grid of faces; with `onPick` set, clicking a card selects it (shop removal,
   * pupation). `pickable` limits which cards can be chosen; the rest are dimmed.
   */
  showDeck(
    run: RunState,
    onPick: ((uid: string) => void) | null,
    title = 'Your deck',
    pickable: ((def: string) => boolean) | null = null,
  ): void {
    const sorted = [...run.deck].sort((a, b) =>
      cardDef(a.def).name.localeCompare(cardDef(b.def).name),
    );
    this.deckList.innerHTML = `
      <button class="btn close">CLOSE</button>
      <h2>${title} · ${run.deck.length} cards</h2>
      <div class="grid">${sorted
        .map((c) => {
          const up =
            c.upgraded ||
            (cardDef(c.def).bug !== null && run.unlocks.includes(cardDef(c.def).bug!));
          const dim = onPick && pickable && !pickable(c.def) ? ' poor' : '';
          return `<div class="pick${dim}" data-uid="${c.uid}" style="background-image:url(${this.faces.url(c.def, up)})"></div>`;
        })
        .join('')}</div>`;
    this.deckList.classList.add('on');
    this.deckList
      .querySelector('.close')
      ?.addEventListener('click', () => this.deckList.classList.remove('on'));
    if (onPick) {
      for (const el of this.deckList.querySelectorAll<HTMLElement>('.pick')) {
        if (el.classList.contains('poor')) continue;
        el.addEventListener('click', () => {
          this.deckList.classList.remove('on');
          onPick(el.dataset['uid'] as string);
        });
      }
    }
  }

  // ---------- reward ----------

  /** `notes` are one-line announcements from the fight's aftermath (a Chrysalis emerging). */
  showReward(run: RunState, notes: string[] = []): void {
    const offer = run.reward;
    if (!offer) return;
    const s = this.show(
      'reward',
      `<div class="veil"></div>
       <div class="panel">
         <h1>SPOILS</h1>
         <h2>🍞 +${offer.crumbs} crumbs · now ${run.crumbs}</h2>
         ${notes.map((n) => `<p class="note">✦ ${n}</p>`).join('')}
         <p>Take one card, or leave them all.</p>
         <div class="cards">${offer.cards
           .map(
             (id) =>
               `<div class="pick" data-def="${id}" style="background-image:url(${this.faces.url(id, run.unlocks.includes(cardDef(id).bug!))})"></div>`,
           )
           .join('')}</div>
         <button class="btn ghost skip">SKIP</button>
       </div>`,
    );
    for (const el of s.querySelectorAll<HTMLElement>('.pick')) {
      el.addEventListener('click', () => this.h.onTakeReward(el.dataset['def'] as string));
    }
    s.querySelector('.skip')?.addEventListener('click', () => this.h.onTakeReward(null));
  }

  // ---------- shop ----------

  showShop(run: RunState): void {
    const shop = run.shop;
    if (!shop) return;
    const snail = this.art.get('npc-snail');
    const canAfford = (price: number) => run.crumbs >= price;
    const wareClass = (sold: boolean, price: number) =>
      ['ware', sold ? 'sold' : '', !sold && !canAfford(price) ? 'poor' : '']
        .filter(Boolean)
        .join(' ');
    const tag = (sold: boolean, price: number) =>
      sold ? '<span class="tag">SOLD</span>' : `<span class="tag">🍞 ${price}</span>`;

    const unlockWares = shop.unlocks
      .map(
        (u, i) => `<div class="${wareClass(u.sold, u.price)}" data-kind="unlock" data-index="${i}">
          <b>${TITLED_UNLOCKS[u.bug]}</b>
          <small>Every ${cardDef(u.bug).name}-family card you have or find this run plays in its upgraded form.</small>
          ${tag(u.sold, u.price)}</div>`,
      )
      .join('');
    const upgradeWares = shop.upgrades
      .map((u, i) => {
        const def = upgradeDef(u.id);
        return `<div class="${wareClass(u.sold, u.price)}" data-kind="upgrade" data-index="${i}">
          <b>${def.name}</b><small>${def.text}</small>${tag(u.sold, u.price)}</div>`;
      })
      .join('');
    const worm = shop.wormillionaire;
    const wormWare = worm
      ? `<div class="${wareClass(worm.sold, worm.price)}" data-kind="wormillionaire" data-index="0">
          <b>Wormillionaire</b><small>Five Wormillion+ (they cost 0 Charge) join your deck.</small>
          ${tag(worm.sold, worm.price)}</div>`
      : '';
    const title = shop.traveling
      ? `THE SNAIL'S CART<span class="discount">20% OFF</span>`
      : `THE SNAIL'S STALL`;
    const subtitle = shop.traveling
      ? 'Caught on the road: two cards and one upgrade, cheap.'
      : 'Cards, titled unlocks, a general upgrade or two. No healing here.';
    const removal =
      shop.removalPrice === null
        ? ''
        : `<button class="btn remove" ${!canAfford(shop.removalPrice) || run.deck.length <= 1 ? 'disabled' : ''}>Remove a card · 🍞 ${shop.removalPrice}</button>`;

    const bg = this.art.get('bg-shop');
    const s = this.show(
      'shop',
      `${bg ? `<img class="bg" src="${bg.src}" alt="">` : '<div class="bg-fallback"></div>'}
       <div class="shade"></div>
       ${snail ? `<img class="snail" src="${snail.src}" alt="">` : ''}
       <div class="stop-hud">❤ <b>${run.hp} / ${run.maxHp}</b><br>🍞 <b>${run.crumbs}</b> crumbs</div>
       <div class="stop-title"><h1>${title}</h1><h2>${subtitle}</h2></div>
       <div class="counter">${shop.cards
         .map((c, i) => {
           const poor = !c.sold && !canAfford(c.price);
           const cls = ['pick', c.sold ? 'sold' : '', poor ? 'poor' : ''].filter(Boolean).join(' ');
           return `<div class="${cls}" data-index="${i}" style="background-image:url(${this.faces.url(c.def, run.unlocks.includes(cardDef(c.def).bug!))})">
             ${c.sold ? '<div class="sold-tag">SOLD</div>' : `<div class="price">🍞 ${c.price}</div>`}</div>`;
         })
         .join('')}</div>
       <div class="wares">${unlockWares}${upgradeWares}${wormWare}</div>
       <div class="actions">
         ${removal}
         <button class="btn ghost leave">${shop.traveling ? 'WAVE IT ON' : 'LEAVE'}</button>
       </div>`,
    );
    s.classList.add('stop');
    for (const el of s.querySelectorAll<HTMLElement>('.pick')) {
      el.addEventListener('click', () => {
        if (el.classList.contains('sold') || el.classList.contains('poor')) return;
        this.h.onBuy(Number(el.dataset['index']));
      });
    }
    for (const el of s.querySelectorAll<HTMLElement>('.ware')) {
      el.addEventListener('click', () => {
        if (el.classList.contains('sold') || el.classList.contains('poor')) return;
        const index = Number(el.dataset['index']);
        if (el.dataset['kind'] === 'unlock') this.h.onBuyUnlock(index);
        else if (el.dataset['kind'] === 'upgrade') this.h.onBuyUpgrade(index);
        else this.h.onBuyWormillionaire();
      });
    }
    s.querySelector('.remove')?.addEventListener('click', () =>
      this.showDeck(run, (uid) => this.h.onRemove(uid), 'Remove which card?'),
    );
    s.querySelector('.leave')?.addEventListener('click', () => this.h.onLeave());
  }

  // ---------- cocoon ----------

  showCocoon(run: RunState): void {
    const heal = Math.min(run.maxHp - run.hp, Math.ceil(run.maxHp * COCOON_HEAL_FRACTION));
    const canPupate = run.deck.some((c) => c.def in PUPATION);
    const bg = this.art.get('bg-cocoon');
    const s = this.show(
      'cocoon',
      `${bg ? `<img class="bg" src="${bg.src}" alt="">` : '<div class="bg-fallback"></div>'}
       <div class="shade"></div>
       <div class="stop-hud">❤ <b>${run.hp} / ${run.maxHp}</b><br>🍞 <b>${run.crumbs}</b> crumbs</div>
       <div class="stop-title"><h1>❂ COCOON</h1><h2>Warm silk in a fold of leaf. The vermin can't find you here — for a while.</h2></div>
       <div class="choices">
         <button class="choice rest"><b>REST</b><small>Curl up in the silk. Heal ${heal} (30% of ${run.maxHp}).</small></button>
         <button class="choice forage"><b>FORAGE</b><small>Root through the leaf litter for ${FORAGE_CRUMBS[0]}–${FORAGE_CRUMBS[1]} crumbs.</small></button>
         <button class="choice pupate" ${canPupate ? '' : 'disabled'}><b>PUPATE</b><small>${
           canPupate
             ? 'Spin a Caterpillar-family card into a Chrysalis. After your next won fight it emerges as a Butterfly.'
             : 'Needs a Caterpillar-family card in your deck.'
         }</small></button>
       </div>
       <button class="btn ghost leave">MOVE ON</button>`,
    );
    s.classList.add('stop');
    s.querySelector('.rest')?.addEventListener('click', () => this.h.onRest());
    s.querySelector('.forage')?.addEventListener('click', () => this.h.onForage());
    s.querySelector('.pupate')?.addEventListener('click', () =>
      this.showDeck(
        run,
        (uid) => this.h.onPupate(uid),
        'Pupate which card?',
        (def) => def in PUPATION,
      ),
    );
    s.querySelector('.leave')?.addEventListener('click', () => this.h.onLeave());
  }

  // ---------- result ----------

  showResult(run: RunState, kind: 'victory' | 'death'): void {
    const st = run.stats;
    const s = this.show(
      'result',
      `<div class="veil"></div>
       <div class="panel">
         <h1 class="${kind}">${kind === 'victory' ? 'THE BEAR IS DOWN' : 'THE GARDEN FALLS'}</h1>
         <h2>${kind === 'victory' ? 'The thicket goes quiet. For now.' : 'Nothing carries over. The garden will be there again tomorrow.'}</h2>
         <div class="stats">
           Fights won: <b>${st.fights}</b> (elites ${st.elites})<br>
           Cards gained: <b>${st.cardsGained}</b> · deck ${run.deck.length}<br>
           Crumbs earned: <b>${st.crumbsEarned}</b><br>
           Seed: <code>${run.seed}</code> <button class="btn ghost copy" style="padding:2px 10px;font-size:12px">copy</button>
         </div>
         <p><button class="btn title">BACK TO THE GARDEN GATE</button></p>
       </div>`,
    );
    s.querySelector('.copy')?.addEventListener(
      'click',
      () => void navigator.clipboard?.writeText(run.seed),
    );
    s.querySelector('.title')?.addEventListener('click', () => this.h.onBackToTitle());
  }
}
