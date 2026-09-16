/**
 * Plays a batch of combat events as animations, in order, against the scene and the UI.
 * Keeps a small ledger of displayed numbers (HP, Block, crumbs) so the HUD can count down hit
 * by hit instead of jumping to the final state, which the caller applies afterwards.
 */
import { enemyDef } from '@content/enemies';
import { PLAYER, type CombatEvent, type CombatState, type EnemyInstance } from '@engine/types';
import type { BattleScene } from '@render/battle/scene';
import { describeIntent, type BattleUI } from '@ui/battle-ui';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function animateEvents(
  events: CombatEvent[],
  prev: CombatState,
  next: CombatState,
  ui: BattleUI,
  scene: BattleScene,
): Promise<void> {
  // Ledger seeded from the previous state.
  const hp = new Map<string, number>();
  const block = new Map<string, number>();
  const poison = new Map<string, number>();
  const weak = new Map<string, number>();
  const known = new Set<string>();
  for (const e of prev.enemies) {
    hp.set(e.uid, e.hp);
    block.set(e.uid, e.statuses.block);
    poison.set(e.uid, e.statuses.poison);
    weak.set(e.uid, e.statuses.weak);
    known.add(e.uid);
  }
  let playerHp = prev.player.hp;
  let playerBlock = prev.player.statuses.block;
  let playerPoison = prev.player.statuses.poison;
  let playerWeak = prev.player.statuses.weak;
  let crumbs = prev.crumbs;
  const nextEnemy = (uid: string): EnemyInstance | undefined =>
    next.enemies.find((e) => e.uid === uid);

  for (const ev of events) {
    switch (ev.type) {
      case 'combatStarted':
      case 'turnStarted':
      case 'deckReshuffled':
      case 'cardDrawn':
      case 'cardDiscarded':
      case 'cardExhausted':
      case 'cardAdded':
        // Hand and piles are re-rendered from the final state by the caller.
        break;

      case 'chargeChanged':
        ui.setCharge(ev.charge, next.player.chargePerTurn);
        break;

      case 'chargeRefunded':
        ui.pop(PLAYER, `☀ refunded ${ev.amount}`, 'status');
        await sleep(160);
        break;

      case 'cardPlayed': {
        const taken = ui.takeCard(ev.uid);
        if (taken) await scene.flyCard(taken.face, { x: taken.x, y: taken.y }, ev.target ?? null);
        break;
      }

      case 'damageDealt': {
        const cur = hp.get(ev.target) ?? 0;
        hp.set(ev.target, cur - ev.amount);
        if (ev.blocked > 0)
          block.set(ev.target, Math.max(0, (block.get(ev.target) ?? 0) - ev.blocked));
        scene.hitEnemy(ev.target);
        ui.setEnemyHp(ev.target, cur - ev.amount);
        ui.setEnemyBlock(ev.target, block.get(ev.target) ?? 0);
        ui.pop(
          ev.target,
          ev.amount > 0 ? `−${ev.amount}` : 'blocked',
          ev.amount > 0 ? 'damage' : 'block',
        );
        await sleep(160);
        break;
      }

      case 'blockGained':
        if (ev.target === PLAYER) {
          playerBlock += ev.amount;
          ui.setPlayerBlock(playerBlock);
          ui.pop(PLAYER, `+${ev.amount} Block`, 'block');
        } else {
          block.set(ev.target, (block.get(ev.target) ?? 0) + ev.amount);
          ui.setEnemyBlock(ev.target, block.get(ev.target) ?? 0);
          ui.pop(ev.target, `+${ev.amount} Block`, 'block');
        }
        await sleep(160);
        break;

      case 'statusApplied':
        if (ev.target === PLAYER) {
          if (ev.status === 'poison') playerPoison += ev.amount;
          else playerWeak += ev.amount;
          ui.setPlayerStatuses(playerPoison, playerWeak);
          ui.pop(PLAYER, `${ev.status === 'poison' ? 'Poison' : 'Weak'} +${ev.amount}`, 'status');
        } else {
          const m = ev.status === 'poison' ? poison : weak;
          m.set(ev.target, (m.get(ev.target) ?? 0) + ev.amount);
          ui.setEnemyStatuses(ev.target, poison.get(ev.target) ?? 0, weak.get(ev.target) ?? 0);
          ui.pop(
            ev.target,
            `${ev.status === 'poison' ? 'Poison' : 'Weak'} +${ev.amount}`,
            'status',
          );
        }
        await sleep(160);
        break;

      case 'poisonTicked':
        if (ev.target === PLAYER) {
          playerHp -= ev.amount;
          playerPoison = Math.max(0, playerPoison - 1);
          ui.setPlayer(playerHp, next.player.maxHp);
          ui.setPlayerStatuses(playerPoison, playerWeak);
          ui.pop(PLAYER, `−${ev.amount}`, 'poison');
        } else {
          hp.set(ev.target, (hp.get(ev.target) ?? 0) - ev.amount);
          poison.set(ev.target, Math.max(0, (poison.get(ev.target) ?? 0) - 1));
          ui.setEnemyHp(ev.target, hp.get(ev.target) ?? 0);
          ui.setEnemyStatuses(ev.target, poison.get(ev.target) ?? 0, weak.get(ev.target) ?? 0);
          scene.hitEnemy(ev.target);
          ui.pop(ev.target, `−${ev.amount}`, 'poison');
        }
        await sleep(220);
        break;

      case 'enemyDied':
        ui.hideEnemy(ev.uid);
        await scene.killEnemy(ev.uid);
        break;

      case 'enemyRevived': {
        // Play Dead: the creature drops into its dead pose and lies there, intent still showing,
        // until it next acts (see enemyActed).
        hp.set(ev.uid, ev.hp);
        const pose = nextEnemy(ev.uid);
        if (pose) {
          const dead = enemyDef(pose.def).deadArt;
          if (dead) scene.setPose(ev.uid, dead);
        }
        scene.reviveEnemy(ev.uid);
        ui.showEnemy(ev.uid);
        ui.setEnemyHp(ev.uid, ev.hp);
        ui.pop(ev.uid, 'plays dead!', 'info');
        await sleep(400);
        break;
      }

      case 'enemySummoned': {
        const e = nextEnemy(ev.uid);
        if (e) {
          hp.set(e.uid, e.hp);
          block.set(e.uid, 0);
          poison.set(e.uid, 0);
          weak.set(e.uid, 0);
          scene.setEnemies(next.enemies);
          ui.addEnemy(e);
          ui.pop(e.uid, enemyDef(e.def).name, 'info');
        }
        await sleep(350);
        break;
      }

      case 'enemyActed': {
        // A creature that was playing dead springs back up to act.
        const actor = nextEnemy(ev.uid);
        if (actor) scene.setPose(ev.uid, enemyDef(actor.def).art);
        ui.flashIntent(ev.uid, true);
        await sleep(260);
        ui.flashIntent(ev.uid, false);
        break;
      }

      case 'intentRolled': {
        const e = nextEnemy(ev.uid);
        if (e)
          ui.setEnemyIntent(
            ev.uid,
            describeIntent({ ...e, intent: ev.move, hp: hp.get(ev.uid) ?? e.hp }),
          );
        break;
      }

      case 'crumbsStolen':
        crumbs -= ev.amount;
        ui.setCrumbs(crumbs);
        ui.pop(ev.uid, `🍞 −${ev.amount}`, 'crumbs');
        await sleep(300);
        break;

      case 'crumbsRecovered':
        crumbs += ev.amount;
        ui.setCrumbs(crumbs);
        ui.pop(ev.uid, `🍞 +${ev.amount}`, 'crumbs');
        await sleep(300);
        break;

      case 'greebleEscaped':
        ui.pop(ev.uid, ev.amount > 0 ? `escaped with ${ev.amount} crumbs` : 'escaped', 'info');
        ui.hideEnemy(ev.uid);
        await scene.killEnemy(ev.uid);
        break;

      case 'playerDamaged':
        playerHp -= ev.amount;
        playerBlock = Math.max(0, playerBlock - ev.blocked);
        ui.setPlayer(playerHp, next.player.maxHp);
        ui.setPlayerBlock(playerBlock);
        ui.playerHit(ev.amount === 0);
        scene.shake(ev.amount > 0 ? Math.min(1, 0.4 + ev.amount / 12) : 0.15);
        ui.pop(
          PLAYER,
          ev.amount > 0 ? `−${ev.amount}` : `blocked ${ev.blocked}`,
          ev.amount > 0 ? 'damage' : 'block',
        );
        await sleep(320);
        break;

      case 'combatWon':
        await sleep(500);
        ui.showOverlay(
          'won',
          ev.crumbsRecovered > 0
            ? `Recovered ${ev.crumbsRecovered} crumbs from the Greeble.`
            : 'The vermin scatter back into the thicket.',
        );
        break;

      case 'combatLost':
        await sleep(500);
        ui.showOverlay('lost', 'The vermin chewed through. Nothing carries over.');
        break;
    }
  }
}
