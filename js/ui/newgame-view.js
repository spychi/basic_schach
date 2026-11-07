// "Neues Spiel" screen: Bauhaus poster on the left, form on the right.
import { pieceSVG } from './pieces.js';
import { loadSettings, saveSettings } from '../store.js';

const SETTINGS_KEY = 'newgame';

const MODES = [
  { value: 'ai', label: 'Gegen Computer' },
  { value: 'local', label: 'Zwei Spieler' },
];
const COLORS = [
  { value: 'w', label: 'Weiß' },
  { value: 'random', label: 'Zufall' },
  { value: 'b', label: 'Schwarz' },
];
const LEVEL_NAMES = ['Anfänger', 'Gelegenheitsspieler', 'Fortgeschritten', 'Stark', 'Meister'];
const TIMES = [
  { value: 'none', label: 'Ohne', time: null },
  { value: '3+2', label: '3 + 2', time: { initialMs: 3 * 60000, incrementMs: 2000 } },
  { value: '5+0', label: '5 + 0', time: { initialMs: 5 * 60000, incrementMs: 0 } },
  { value: '10+0', label: '10 + 0', time: { initialMs: 10 * 60000, incrementMs: 0 } },
  { value: '15+10', label: '15 + 10', time: { initialMs: 15 * 60000, incrementMs: 10000 } },
];

const DEFAULTS = { mode: 'ai', color: 'w', level: 3, time: '10+0' };

const COLOR_ICONS = {
  w: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="3" y="3" width="34" height="34" class="ng-ico-paper"/></svg>',
  random: '<svg viewBox="0 0 40 40" aria-hidden="true"><polygon points="3,3 37,3 3,37" class="ng-ico-paper"/><polygon points="37,3 37,37 3,37" class="ng-ico-ink"/><rect x="3" y="3" width="34" height="34" class="ng-ico-frame"/></svg>',
  b: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="3" y="3" width="34" height="34" class="ng-ico-ink"/></svg>',
};

const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h16M13 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="miter"/></svg>';

function sanitize(saved) {
  const s = { ...DEFAULTS };
  if (saved && typeof saved === 'object') {
    if (MODES.some((m) => m.value === saved.mode)) s.mode = saved.mode;
    if (COLORS.some((c) => c.value === saved.color)) s.color = saved.color;
    if (Number.isInteger(saved.level) && saved.level >= 1 && saved.level <= 5) s.level = saved.level;
    if (TIMES.some((t) => t.value === saved.time)) s.time = saved.time;
  }
  return s;
}

export class NewGameView {
  constructor(root, { onStart, onBack } = {}) {
    this.root = root;
    this.onStart = onStart || (() => {});
    this.onBack = onBack || (() => {});
    this.state = sanitize(loadSettings()[SETTINGS_KEY]);
    this._build();
    this._sync();
  }

  /** Shows the screen. canGoBack: whether a running game exists to return to. */
  show({ canGoBack = false } = {}) {
    this.state = sanitize(loadSettings()[SETTINGS_KEY] || this.state);
    this.backLink.hidden = !canGoBack;
    this.root.hidden = false;
    this._sync();
  }

  hide() { this.root.hidden = true; }

  // ---------------------------------------------------------------- build
  _build() {
    this.root.classList.add('newgame');
    this.root.innerHTML = `
      <div class="newgame__poster" aria-hidden="true">
        <div class="ng-circle"></div>
        <div class="ng-square"></div>
        <div class="ng-bar"></div>
        <div class="ng-king">${pieceSVG('k')}</div>
        <div class="ng-knight">${pieceSVG('N')}</div>
        <div class="ng-word">
          <div class="ng-word__title">SCHACH</div>
          <div class="ng-word__sub">Kreis · Quadrat · Dreieck</div>
        </div>
      </div>
      <form class="newgame__form" novalidate>
        <a href="#" class="newgame__back">← Zurück zur Partie</a>
        <h1 class="newgame__h1">NEUES SPIEL</h1>
        <fieldset class="ng-field" data-group="mode"><legend class="section-title">Modus</legend><div class="ng-row ng-row--modes"></div></fieldset>
        <fieldset class="ng-field" data-group="color"><legend class="section-title">Deine Farbe</legend><div class="ng-row ng-row--colors"></div></fieldset>
        <fieldset class="ng-field" data-group="level"><legend class="section-title">Spielstärke</legend>
          <div class="ng-row ng-row--levels"><div class="ng-levels"></div><p class="ng-level-text" aria-live="polite"></p></div>
        </fieldset>
        <fieldset class="ng-field" data-group="time"><legend class="section-title">Bedenkzeit</legend><div class="ng-row ng-row--times"></div></fieldset>
        <button type="submit" class="btn btn--primary newgame__start">Partie starten ${ARROW}</button>
      </form>`;

    const q = (s) => this.root.querySelector(s);
    this.form = q('.newgame__form');
    this.backLink = q('.newgame__back');
    this.colorField = q('[data-group="color"]');
    this.levelField = q('[data-group="level"]');
    this.levelText = q('.ng-level-text');

    this.groups = {
      mode: this._makeGroup(q('.ng-row--modes'), 'mode', MODES, (o) => o.label),
      color: this._makeGroup(q('.ng-row--colors'), 'color', COLORS,
        (o) => `<span class="ng-tile">${COLOR_ICONS[o.value]}</span><span>${o.label}</span>`, true),
      level: this._makeGroup(q('.ng-levels'), 'level',
        LEVEL_NAMES.map((n, i) => ({ value: i + 1, label: String(i + 1), name: n })),
        (o) => o.label, false, (o) => `Stufe ${o.value}, ${o.name}`),
      time: this._makeGroup(q('.ng-row--times'), 'time', TIMES, (o) => o.label),
    };
    for (const btn of this.groups.level) btn.classList.add('ng-level');
    for (const btn of this.groups.time) btn.classList.add('ng-chip');
    for (const btn of this.groups.mode) btn.classList.add('ng-mode');
    for (const btn of this.groups.color) btn.classList.add('ng-color');

    this.backLink.addEventListener('click', (e) => { e.preventDefault(); this.onBack(); });
    this.form.addEventListener('submit', (e) => { e.preventDefault(); this._start(); });
  }

  _makeGroup(container, key, options, html, raw = false, aria = null) {
    const buttons = options.map((opt) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn';
      b.dataset.value = String(opt.value);
      b.innerHTML = html(opt);
      if (aria) b.setAttribute('aria-label', aria(opt));
      b.addEventListener('click', () => this._select(key, opt.value));
      b.addEventListener('keydown', (e) => this._onKey(e, key, options, buttons));
      container.appendChild(b);
      return b;
    });
    container.dataset.key = key;
    return buttons;
  }

  _onKey(e, key, options, buttons) {
    const forward = ['ArrowRight', 'ArrowDown'];
    const back = ['ArrowLeft', 'ArrowUp'];
    let dir = 0;
    if (forward.includes(e.key)) dir = 1;
    else if (back.includes(e.key)) dir = -1;
    else return;
    e.preventDefault();
    const cur = buttons.indexOf(e.currentTarget);
    const next = (cur + dir + buttons.length) % buttons.length;
    this._select(key, options[next].value);
    buttons[next].focus();
  }

  _select(key, value) {
    this.state[key] = value;
    this._sync();
  }

  // ---------------------------------------------------------------- state
  _sync() {
    const s = this.state;
    for (const [key, buttons] of Object.entries(this.groups)) {
      buttons.forEach((b) => {
        const selected = b.dataset.value === String(s[key]);
        b.setAttribute('aria-pressed', String(selected));
        b.tabIndex = selected ? 0 : -1;
        if (key === 'level') b.classList.toggle('is-filled', Number(b.dataset.value) <= s.level);
      });
    }
    this.levelText.textContent = `Stufe ${s.level} von 5 · ${LEVEL_NAMES[s.level - 1]}`;
    const ai = s.mode === 'ai';
    this.colorField.hidden = !ai;
    this.levelField.hidden = !ai;
  }

  _start() {
    const s = this.state;
    saveSettings({ [SETTINGS_KEY]: { ...s } });
    const t = TIMES.find((x) => x.value === s.time);
    this.onStart({
      mode: s.mode,
      color: s.color,
      level: s.level,
      time: t && t.time ? { ...t.time } : null,
    });
  }
}
