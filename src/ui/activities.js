/**
 * Activity overlay: renders every exercise type, gives immediate correction
 * and reports each attempt back to the mission or practice session.
 */
import { drawIcon } from './icons.js';
import { checkAnswer, SKILL_INFO } from '../content/schema.js';
import { shuffle } from '../core/util.js';

export function h(tag, props = null, ...children) {
  const node = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'dataset') Object.assign(node.dataset, value);
      else if (key.startsWith('on') && typeof value === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === 'style') node.setAttribute('style', value);
      else if (key in node) node[key] = value;
      else node.setAttribute(key, value);
    }
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export class ActivityRunner {
  constructor({ overlay, elements, audio, getSettings, onQuitRequest, syncRoot }) {
    this.overlay = overlay;
    this.els = elements;
    this.audio = audio;
    this.getSettings = getSettings || (() => ({}));
    this.onQuitRequest = onQuitRequest || (() => {});
    this.syncRoot = syncRoot || (() => {});
    this.timers = [];
    this.els.quit?.addEventListener('click', () => this.requestQuit());
  }

  get isOpen() { return !this.overlay.hidden; }

  requestQuit() {
    const handler = this.config?.onQuit || this.onQuitRequest;
    handler?.();
  }

  open(config) {
    // A caller can hand over an empty or malformed list: fail visibly and
    // cheaply instead of throwing in the middle of rendering.
    const items = (config?.items || []).filter((item) => item && item.id && item.type);
    if (!items.length) {
      this.overlay.hidden = true;
      this.syncRoot();
      config?.onFinish?.({ answers: [], correct: 0, total: 0, percent: null });
      return;
    }
    this.config = { ...config, items };
    this.index = 0;
    this.answers = [];
    this.phase = 'question';
    this.overlay.hidden = false;
    this.syncRoot();
    this.isFinal = Boolean(this.config.final);
    this.els.panel?.classList.toggle('is-final', this.isFinal);
    this.els.kicker.textContent = this.config.kicker || '';
    this.els.title.textContent = this.config.title || 'Activity';
    this.els.icon.textContent = this.config.icon || (SKILL_INFO[this.config.skill]?.icon ?? '★');
    this.els.skill.textContent = SKILL_INFO[this.config.skill]?.name || this.config.skill || '';
    this.audio.play('open');
    this.renderItem();
  }

  close() {
    this.timers.forEach((id) => clearTimeout(id));
    this.timers = [];
    this.overlay.hidden = true;
    this.config = null;
    this.syncRoot();
  }

  later(fn, ms) {
    const id = setTimeout(fn, ms);
    this.timers.push(id);
    return id;
  }

  renderItem() {
    const { items, skill } = this.config;
    const item = items[this.index];
    this.item = item;
    this.phase = 'question';
    this.answered = false;

    this.els.counter.textContent = `${this.index + 1} / ${items.length}`;
    this.els.skill.textContent = SKILL_INFO[item.skill || skill]?.name || skill;
    this.els.body.replaceChildren();
    this.els.foot.replaceChildren();
    this.els.body.scrollTop = 0;

    if (item.objective) {
      this.els.body.append(h('div', { class: 'objective' }, h('strong', { text: 'Objective' }), item.objective));
    }
    if (item.instruction) {
      this.els.body.append(h('p', { class: 'micro muted', text: item.instruction }));
      if (this.getSettings().frenchHints && item.instructionFr) {
        this.els.body.append(h('p', { class: 'micro muted', style: 'font-style:italic', text: item.instructionFr }));
      }
    }
    if (item.passage) {
      this.els.body.append(h('div', { class: 'passage' },
        h('strong', { class: 'passage-title', text: item.passage.title || 'Text' }),
        item.passage.text,
      ));
    }
    if (item.prompt) this.els.body.append(h('p', { class: 'question-text', text: item.prompt }));

    switch (item.type) {
      case 'choice': this.renderChoice(item); break;
      case 'match': this.renderMatch(item); break;
      case 'order': this.renderOrder(item); break;
      case 'short': this.renderShort(item); break;
      default: this.renderFallback(item); break;
    }
  }

  /* --------------------------------------------------------------- choice */
  renderChoice(item) {
    const optionWrap = h('div', { class: 'options' });
    const buttons = item.options.map((option, i) => h('button', {
      class: 'option-btn',
      type: 'button',
      onclick: () => this.submitChoice(item, i, buttons),
    }, h('span', { class: 'opt-key', text: LETTERS[i] ?? String(i + 1) }), h('span', { text: option })));
    buttons.forEach((b) => optionWrap.append(b));
    this.els.body.append(optionWrap);
    this.optionButtons = buttons;
    this.setFootButton('Choose an answer', null, true);
  }

  submitChoice(item, index, buttons) {
    if (this.answered) return;
    this.answered = true;
    const { correct } = checkAnswer(item, index);
    buttons.forEach((b, i) => {
      b.disabled = true;
      if (i === item.answer) b.classList.add('is-correct');
      else if (i === index) b.classList.add('is-wrong');
    });
    this.finishAnswer(item, correct, index);
  }

  /* ---------------------------------------------------------------- match */
  renderMatch(item) {
    const words = shuffle(item.pairs.map((p) => p.term));
    const pictures = shuffle(item.pairs.map((p) => p.icon));
    this.matchState = { selected: null, matched: new Set(), mistakes: 0 };

    const wordCol = h('div', { style: 'display:grid;gap:8px' });
    const picCol = h('div', { style: 'display:grid;gap:8px' });

    for (const word of words) {
      const cell = h('button', { class: 'match-cell', type: 'button', dataset: { term: word } },
        h('span', { text: word }));
      cell.addEventListener('click', () => this.selectWord(word, cell));
      wordCol.append(cell);
    }
    for (const icon of pictures) {
      const canvas = h('canvas', { width: 44, height: 44, 'aria-hidden': 'true' });
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      drawIcon(ctx, icon, 4, 4, 36);
      const cell = h('button', { class: 'match-cell', type: 'button', dataset: { icon }, 'aria-label': `Picture option ${icon}` }, canvas);
      cell.addEventListener('click', () => this.selectPicture(icon, cell));
      picCol.append(cell);
    }

    this.els.body.append(h('div', { class: 'match-grid' }, wordCol, picCol));
    this.matchWordCells = [...wordCol.children];
    this.matchPicCells = [...picCol.children];
    this.setFootButton('Match every word', null, true);
  }

  selectWord(word, cell) {
    if (this.answered || this.matchState.matched.has(word)) return;
    this.matchState.selected = { word, cell };
    this.matchWordCells.forEach((c) => c.classList.toggle('is-selected', c === cell));
    this.audio.play('select');
    this.refreshMatchFoot();
  }

  selectPicture(icon, cell) {
    if (this.answered || cell.classList.contains('is-done')) return;
    const selected = this.matchState.selected;
    if (!selected) {
      this.els.body.append(h('p', { class: 'micro muted', text: 'Choose a word first, then its picture.' }));
      return;
    }
    const pair = this.item.pairs.find((p) => p.term === selected.word);
    const good = pair && pair.icon === icon;
    if (good) {
      this.matchState.matched.add(selected.word);
      selected.cell.classList.remove('is-selected');
      selected.cell.classList.add('is-done');
      selected.cell.disabled = true;
      cell.classList.add('is-done');
      cell.disabled = true;
      this.matchState.selected = null;
      this.audio.play('correct');
      if (this.matchState.matched.size === this.item.pairs.length) {
        const correct = this.matchState.mistakes === 0;
        this.answered = true;
        this.finishAnswer(this.item, correct, [...this.matchState.matched], {
          prefix: correct ? 'Every word matched correctly.' : `Matched with ${this.matchState.mistakes} mistake${this.matchState.mistakes > 1 ? 's' : ''}.`,
        });
        return;
      }
      this.refreshMatchFoot();
    } else {
      this.matchState.mistakes += 1;
      this.audio.play('wrong');
      cell.classList.add('is-wrong');
      this.later(() => cell.classList.remove('is-wrong'), 420);
    }
  }

  refreshMatchFoot() {
    const total = this.item.pairs.length;
    const done = this.matchState.matched.size;
    this.setFootButton(`Matched ${done} / ${total}`, null, true);
  }

  /* ---------------------------------------------------------------- order */
  renderOrder(item) {
    this.orderPicked = [];
    this.orderBank = shuffle(item.words);
    this.els.body.append(h('p', { class: 'micro muted', text: 'Tap words to add them. Tap a word in your sentence to remove it.' }));
    this.answerLine = h('div', { class: 'answer-line', 'aria-live': 'polite' });
    this.bankLine = h('div', { class: 'word-bank' });
    this.els.body.append(this.answerLine, this.bankLine);
    this.drawOrderLines();
    this.els.foot.replaceChildren();
    this.orderCheck = h('button', { class: 'btn btn-primary', type: 'button', disabled: true, onclick: () => this.submitOrder() }, 'Check sentence');
    this.els.foot.append(this.orderCheck);
  }

  drawOrderLines() {
    this.answerLine.replaceChildren();
    if (!this.orderPicked.length) {
      this.answerLine.append(h('span', { class: 'micro muted', text: 'Your sentence will appear here…' }));
    }
    this.orderPicked.forEach((word, i) => {
      this.answerLine.append(h('button', {
        class: 'word-chip', type: 'button', onclick: () => {
          if (this.answered) return;
          this.orderPicked.splice(i, 1);
          this.drawOrderLines();
          this.audio.play('click');
        },
      }, word));
    });
    this.bankLine.replaceChildren();
    this.orderBank.forEach((word) => {
      const chip = h('button', {
        class: 'word-chip', type: 'button', disabled: this.answered || this.pickCount(word) >= this.count(word),
        onclick: () => {
          if (this.answered) return;
          this.orderPicked.push(word);
          this.drawOrderLines();
          this.audio.play('click');
        },
      }, word);
      this.bankLine.append(chip);
    });
    if (this.orderCheck) this.orderCheck.disabled = this.orderPicked.length !== this.item.words.length;
  }

  count(word) {
    return this.item.words.filter((w) => w === word).length;
  }

  pickCount(word) {
    return this.orderPicked.filter((w) => w === word).length;
  }

  submitOrder() {
    if (this.answered) return;
    const { correct, expected } = checkAnswer(this.item, this.orderPicked);
    this.answered = true;
    this.orderCheck.disabled = true;
    this.finishAnswer(this.item, correct, [...this.orderPicked], {
      expected: correct ? null : expected,
    });
  }

  /* ---------------------------------------------------------------- short */
  renderShort(item) {
    const input = h('input', {
      type: 'text',
      class: 'answer-input',
      placeholder: 'Write your answer in English',
      autocomplete: 'off',
      spellcheck: 'false',
      style: 'width:100%;min-height:48px;padding:10px 12px;background:#0a1024;border:2px solid var(--line);border-radius:4px;color:var(--text);font-size:15px',
    });
    this.shortInput = input;
    this.els.body.append(input);
    this.els.foot.replaceChildren();
    this.shortCheck = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => this.submitShort() }, 'Check answer');
    this.els.foot.append(this.shortCheck);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') this.submitShort();
    });
    input.focus();
  }

  submitShort() {
    if (this.answered) return;
    const value = this.shortInput?.value || '';
    if (!value.trim()) return;
    const { correct, expected } = checkAnswer(this.item, value);
    this.answered = true;
    this.finishAnswer(this.item, correct, value, { expected: correct ? null : expected });
  }

  /* -------------------------------------------------------------- fallback */
  renderFallback(item) {
    this.els.body.append(h('p', { class: 'muted', text: 'This exercise type is not available in this version.' }));
    this.setFootButton('Skip', () => this.finishAnswer(item, null, null, { participation: true }));
  }

  /* ---------------------------------------------------------------- shared */
  setFootButton(label, onClick, disabled = false) {
    this.els.foot.replaceChildren();
    this.primaryBtn = h('button', {
      class: 'btn btn-primary', type: 'button', disabled,
      onclick: onClick,
    }, label);
    this.els.foot.append(this.primaryBtn);
  }

  finishAnswer(item, correct, response, extra = {}) {
    const settings = this.getSettings();
    const good = correct === true;
    this.audio.play(good ? 'correct' : correct === false ? 'wrong' : 'pickup');
    this.lastAnswer = { item, correct, response };
    this.answers.push(this.lastAnswer);
    this.els.body.append(h('div', { class: `feedback ${good ? 'is-good' : correct === false ? 'is-bad' : ''}` },
      h('strong', { text: extra.participation ? 'Recorded' : good ? 'Correct' : 'Not quite' }),
      extra.prefix ? h('p', { text: extra.prefix }) : null,
      extra.expected ? h('p', { class: 'why', text: `Model answer: ${extra.expected}` }) : null,
      h('p', { class: 'why', text: item.explanation || '' }),
      settings.frenchHints && item.fr ? h('span', { class: 'fr-hint', text: item.fr }) : null,
    ));
    this.els.body.scrollTop = this.els.body.scrollHeight;
    this.config.onAnswer?.(this.lastAnswer);
    const isLast = this.index >= this.config.items.length - 1;
    this.els.foot.replaceChildren();
    this.els.foot.append(h('button', {
      class: 'btn btn-primary', type: 'button',
      onclick: () => this.advance(),
    }, isLast ? (this.config.finishLabel || 'See results') : 'Continue ▸'));
    this.lastWasGood = good;
    this.primaryBtn = null;
  }

  advance() {
    if (this.index >= this.config.items.length - 1) {
      const cfg = this.config;
      const summary = this.summarise();
      this.close();
      cfg.onFinish?.(summary);
      return;
    }
    this.index += 1;
    this.renderItem();
  }

  summarise() {
    const graded = this.answers.filter((a) => a.correct !== null);
    const correct = graded.filter((a) => a.correct).length;
    return {
      answers: [...this.answers],
      correct,
      total: graded.length,
      percent: graded.length ? Math.round((correct / graded.length) * 100) : null,
    };
  }
}
