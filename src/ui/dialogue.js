/**
 * NPC dialogue overlay. Data lives in src/content/dialogues.js.
 * Choices are optional: a node with `next` simply continues.
 */
import { drawPortrait } from '../world/sprites.js';
import { npcs as NPC_DATA } from '../content/dialogues.js';

export class DialogueRunner {
  constructor({ overlay, elements, audio, getSettings, onComplete, syncRoot }) {
    this.overlay = overlay;
    this.els = elements;
    this.audio = audio;
    this.getSettings = getSettings || (() => ({}));
    this.onComplete = onComplete || (() => {});
    this.syncRoot = syncRoot || (() => {});
    this.els.next?.addEventListener('click', () => this.advance());
    this.overlay.addEventListener('click', (event) => {
      if (event.target === this.overlay) this.close(false);
    });
  }

  get isOpen() { return !this.overlay.hidden; }

  open(npcId) {
    const npc = NPC_DATA[npcId];
    if (!npc) return;
    this.npc = npc;
    this.returned = false;
    this.overlay.hidden = false;
    this.syncRoot();
    this.els.name.textContent = `${npc.name} · ${npc.role}`;
    const ctx = this.els.portrait.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    drawPortrait(ctx, 96, 96, npc.palette, { accent: '#0a1024' });
    this.goTo(npc.start || 'welcome');
    this.audio.play('open');
  }

  goTo(id) {
    const node = this.npc.nodes[id];
    if (!node) { this.close(false); return; }
    this.node = node;
    this.nodeId = id;
    this.els.text.textContent = node.text;
    if (this.getSettings().frenchHints && node.fr) {
      this.els.fr.hidden = false;
      this.els.fr.textContent = node.fr;
    } else {
      this.els.fr.hidden = true;
      this.els.fr.textContent = '';
    }
    this.els.choices.replaceChildren();
    if (node.choices?.length) {
      node.choices.forEach((choice) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn';
        btn.textContent = choice.text;
        btn.addEventListener('click', () => {
          this.audio.play('click');
          if (choice.next) this.goTo(choice.next);
          else this.close(true);
        });
        this.els.choices.append(btn);
      });
      this.els.next.hidden = true;
    } else {
      this.els.next.hidden = false;
      this.els.next.textContent = node.close ? 'End conversation ▸' : 'Continue ▸';
    }
    this.els.body?.scrollTo?.(0, 0);
  }

  advance() {
    if (!this.node) return;
    if (this.node.close) {
      this.close(true);
      return;
    }
    if (this.node.next) {
      this.goTo(this.node.next);
      return;
    }
    this.close(true);
  }

  close(completed) {
    if (!this.npc) return;
    const npc = this.npc;
    this.overlay.hidden = true;
    this.node = null;
    this.syncRoot();
    this.npc = null;
    this.audio.play('close');
    this.onComplete({ npc, completed: Boolean(completed) });
  }
}
