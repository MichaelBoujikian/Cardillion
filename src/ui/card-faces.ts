/**
 * Card faces rendered once per (card, form, art) and shared by every screen that shows a card:
 * the hand, rewards, the shop, the deck list.
 */
import { cardDef, cardForm } from '@content/cards';
import { drawCardFace, type ArtCache } from '@render/battle/textures';

export class CardFaces {
  private readonly canvases = new Map<string, HTMLCanvasElement>();
  private readonly urls = new Map<string, string>();

  constructor(private readonly art: ArtCache) {}

  face(defId: string, upgraded: boolean): HTMLCanvasElement {
    const def = cardDef(defId);
    // An upgraded form with its own art (Sir Reginald V) shows it; otherwise the base art.
    const art =
      (upgraded && def.upgradedArt ? this.art.get(def.upgradedArt) : undefined) ??
      this.art.get(def.art) ??
      null;
    const key = `${def.id}|${upgraded ? 1 : 0}|${art ? 1 : 0}`;
    let face = this.canvases.get(key);
    if (!face) {
      face = drawCardFace(def, cardForm(def, upgraded), { art, upgraded });
      this.canvases.set(key, face);
    }
    return face;
  }

  /** Data URL for CSS `background-image`. */
  url(defId: string, upgraded: boolean): string {
    const key = `${defId}|${upgraded ? 1 : 0}`;
    let url = this.urls.get(key);
    if (!url) {
      url = this.face(defId, upgraded).toDataURL('image/png');
      this.urls.set(key, url);
    }
    return url;
  }
}
