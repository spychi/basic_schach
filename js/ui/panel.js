// Game screen: header, player bars, board container, status, move list, actions.
//
// Panel.render(data) data format:
// @typedef {Object} PanelData
// @property {{w:{name:string, subtitle?:string}, b:{name:string, subtitle?:string}}} players
// @property {'w'|'b'} [bottomColor='w']   colour whose bar sits below the board (the board is not flipped for 'w')
// @property {'w'|'b'} turn                 side to move
// @property {number} moveNumber            full move number shown as "Zug N"
// @property {string} [statusText]          e.g. "Weiß am Zug", "Computer denkt …", "Schachmatt"
// @property {{san:string}[]} history       half-moves in order
// @property {number|null} [currentPly]     number of half-moves of the position shown (1-based index of the
//                                          highlighted move, 0 = none). null/undefined = last move
// @property {'w'|'b'} [firstColor='w']     colour of history[0] (only differs for custom start positions)
// @property {number} [firstMoveNumber=1]   move number of history[0]
// @property {{w:string[], b:string[]}} captured  pieces captured BY that colour (piece chars, e.g. w: ['p','n'])
// @property {null|{w:number, b:number, running:'w'|'b'|null}} clocks  remaining ms; null = no clocks shown
// @property {string|null} [opening]       opening name
// @property {boolean} [canUndo]
// @property {boolean} [gameOver]          disables draw/resign, hides the turn marker
//
// Constructor callbacks: onUndo, onFlip, onDrawOffer, onResign, onNewGame, onSettings, onSelectPly(ply)
//   onSelectPly(ply): ply = 1-based number of half-moves to show (click on a move in the list).
// panel.boardContainer: element the BoardView is mounted in.

import { pieceSVG, pieceName } from './pieces.js';

const ICONS = {
  undo: '<path d="M8 5 L3 10 L8 15"/><path d="M3 10 H15 A5 5 0 0 1 15 20 H11"/>',
  flip: '<path d="M7 20 V4 M3 8 L7 4 L11 8"/><path d="M17 4 V20 M13 16 L17 20 L21 16"/>',
  draw: '<path d="M4 9 H20 M4 15 H20"/>',
  resign: '<path d="M6 21 V3"/><path d="M6 4 H19 L15.5 8.5 L19 13 H6"/>',
  settings: '<path d="M3 7 H21 M3 17 H21"/>'
    + '<circle cx="9" cy="7" r="2.6" style="fill:var(--paper)"/>'
    + '<circle cx="15" cy="17" r="2.6" style="fill:var(--paper)"/>',
  plus: '<path d="M12 4 V20 M4 12 H20"/>',
};

function icon(name) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" '
    + 'stroke-linejoin="miter" aria-hidden="true" focusable="false">' + ICONS[name] + '</svg>';
}

const LOGO = '<svg class="brand__logo" viewBox="0 0 60 60" aria-hidden="true" focusable="false">'
  + '<circle cx="15" cy="15" r="14" style="fill:var(--red)"/>'
  + '<rect x="31" y="1" width="28" height="28" style="fill:var(--blue)"/>'
  + '<polygon points="1,59 29,59 15,31" style="fill:var(--yellow)"/>'
  + '<path d="M31 59 L31 31 A28 28 0 0 1 59 59 Z" style="fill:var(--ink)"/>'
  + '</svg>';

function playerHTML(color) {
  return `<div class="player" data-color="${color}" data-pos="${color === 'w' ? 'bottom' : 'top'}">`
    + '<span class="player__swatch" aria-hidden="true"></span>'
    + '<div class="player__id"><span class="player__name"></span><span class="player__sub"></span></div>'
    + `<div class="player__captured" role="group" aria-label="Geschlagene Figuren"></div>`
    + '<div class="player__clock" hidden></div>'
    + '</div>';
}

function actionHTML(act, label, extra = '') {
  return `<button type="button" class="btn actions__btn ${extra}" data-act="${act}">`
    + `${icon(act)}<span>${label}</span></button>`;
}

const TEMPLATE = `
<header class="game__head">
  <div class="brand">${LOGO}<span class="brand__word">Schach</span></div>
  <div class="game__head-actions">
    <button type="button" class="btn btn--primary game__new" data-act="new">${icon('plus')}<span class="game__new-label">Neues Spiel</span></button>
    <button type="button" class="icon-btn" data-act="settings" aria-label="Einstellungen">${icon('settings')}</button>
  </div>
</header>
<div class="game__main">
  <section class="game__board-col" aria-label="Brett und Spieler">
    ${playerHTML('b')}
    <div class="game__board"></div>
    ${playerHTML('w')}
  </section>
  <aside class="game__side">
    <div class="status">
      <p class="status__text" role="status"></p>
      <p class="status__move"></p>
    </div>
    <section class="moves" aria-label="Zugliste">
      <div class="moves__head">
        <h2 class="section-title">Züge</h2>
        <p class="moves__opening"></p>
      </div>
      <div class="moves__scroll"><ol class="moves__list"></ol></div>
    </section>
    <div class="actions">
      ${actionHTML('undo', 'Zurück')}
      ${actionHTML('flip', 'Drehen')}
      ${actionHTML('draw', 'Remis')}
      ${actionHTML('resign', 'Aufgeben', 'btn--danger')}
    </div>
  </aside>
</div>`;

const PIECE_ORDER = 'qrbnp';

/** Formats milliseconds: '09:12', '1:05:00', below 10 s '0:08.4'. */
export function formatClock(ms) {
  ms = Math.max(0, ms);
  if (ms < 10000) {
    const t = Math.floor(ms / 100);
    return `0:0${Math.floor(t / 10)}.${t % 10}`;
  }
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

export class Panel {
  constructor(root, callbacks = {}) {
    this.root = root;
    this.cb = callbacks;
    root.classList.add('game');
    root.innerHTML = TEMPLATE;

    const q = (s) => root.querySelector(s);
    this.boardContainer = q('.game__board');
    this._bars = {};
    for (const c of ['w', 'b']) {
      const el = q(`.player[data-color="${c}"]`);
      this._bars[c] = {
        el,
        name: el.querySelector('.player__name'),
        sub: el.querySelector('.player__sub'),
        captured: el.querySelector('.player__captured'),
        clock: el.querySelector('.player__clock'),
        capKey: null,
      };
    }
    this._statusText = q('.status__text');
    this._statusMove = q('.status__move');
    this._opening = q('.moves__opening');
    this._list = q('.moves__list');
    this._btn = {
      undo: q('[data-act="undo"]'),
      flip: q('[data-act="flip"]'),
      draw: q('[data-act="draw"]'),
      resign: q('[data-act="resign"]'),
    };
    this._movesKey = null;
    this._plyBtns = [];
    this._curIdx = -2;

    const handlers = {
      new: 'onNewGame', settings: 'onSettings', undo: 'onUndo',
      flip: 'onFlip', draw: 'onDrawOffer', resign: 'onResign',
    };
    root.addEventListener('click', (e) => {
      const ply = e.target.closest('[data-ply]');
      if (ply) {
        if (this.cb.onSelectPly) this.cb.onSelectPly(Number(ply.dataset.ply));
        return;
      }
      const act = e.target.closest('[data-act]');
      if (!act || act.disabled) return;
      const fn = this.cb[handlers[act.dataset.act]];
      if (fn) fn();
    });
  }

  /** @param {PanelData} d */
  render(d) {
    const {
      players, bottomColor = 'w', turn, moveNumber, history = [], currentPly,
      captured = { w: [], b: [] }, clocks = null, opening = null,
      canUndo = false, gameOver = false, firstColor = 'w', firstMoveNumber = 1,
    } = d;
    const statusText = d.statusText || (turn === 'w' ? 'Weiß am Zug' : 'Schwarz am Zug');

    for (const c of ['w', 'b']) {
      const bar = this._bars[c];
      const pos = c === bottomColor ? 'bottom' : 'top';
      if (bar.el.dataset.pos !== pos) bar.el.dataset.pos = pos;
      bar.el.classList.toggle('is-turn', !gameOver && turn === c);
      const p = (players && players[c]) || { name: c === 'w' ? 'Weiß' : 'Schwarz' };
      setText(bar.name, p.name || '');
      setText(bar.sub, p.subtitle || '');
      this._renderCaptured(bar, captured[c] || []);
      if (clocks) {
        bar.clock.hidden = false;
        setText(bar.clock, formatClock(clocks[c]));
        bar.clock.classList.toggle('is-running', clocks.running === c);
      } else {
        bar.clock.hidden = true;
      }
    }

    setText(this._statusText, statusText);
    setText(this._statusMove, `Zug ${moveNumber}`);
    setText(this._opening, opening || '');
    this._renderMoves(history, currentPly, firstColor, firstMoveNumber);

    this._btn.undo.disabled = !canUndo;
    this._btn.draw.disabled = gameOver;
    this._btn.resign.disabled = gameOver;
  }

  _renderCaptured(bar, pieces) {
    const sorted = pieces.slice().sort(
      (a, b) => PIECE_ORDER.indexOf(a.toLowerCase()) - PIECE_ORDER.indexOf(b.toLowerCase()),
    );
    const key = sorted.join('');
    if (key === bar.capKey) return;
    bar.capKey = key;
    bar.captured.innerHTML = sorted
      .map((p) => `<span class="cap" title="${pieceName(p)}">${pieceSVG(p, { decorative: true })}</span>`)
      .join('');
  }

  _renderMoves(history, currentPly, firstColor, firstNo) {
    const list = this._list;
    const key = `${firstColor}${firstNo}|${history.map((h) => h.san).join(' ')}`;
    let rebuilt = false;
    if (key !== this._movesKey) {
      rebuilt = true;
      this._movesKey = key;
      this._plyBtns = [];
      list.textContent = '';
      if (!history.length) {
        const li = document.createElement('li');
        li.className = 'moves__empty';
        li.textContent = 'Noch keine Züge';
        list.append(li);
      } else {
        const off = firstColor === 'b' ? 1 : 0;
        const rows = Math.ceil((history.length + off) / 2);
        for (let r = 0; r < rows; r++) {
          const li = document.createElement('li');
          li.className = 'moves__row';
          const num = document.createElement('span');
          num.className = 'moves__num';
          num.textContent = `${firstNo + r}.`;
          li.append(num);
          for (let side = 0; side < 2; side++) {
            const idx = r * 2 + side - off;
            if (idx < 0 || idx >= history.length) {
              const empty = document.createElement('span');
              empty.className = 'moves__ply moves__ply--empty';
              empty.setAttribute('aria-hidden', 'true');
              li.append(empty);
              continue;
            }
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'moves__ply';
            b.dataset.ply = String(idx + 1);
            b.textContent = history[idx].san;
            this._plyBtns[idx] = b;
            li.append(b);
          }
          list.append(li);
        }
      }
    }

    const cur = (currentPly == null ? history.length : currentPly) - 1;
    if (!rebuilt && cur === this._curIdx) return;
    this._curIdx = cur;
    this._plyBtns.forEach((b, i) => {
      const on = i === cur;
      b.classList.toggle('is-current', on);
      if (on) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
    const active = this._plyBtns[cur];
    if (!active) return;
    if (cur === history.length - 1) {
      list.scrollTop = list.scrollHeight;
      list.scrollLeft = list.scrollWidth;
      return;
    }
    // keep the highlighted move visible without scrolling the page
    const t = active.offsetTop;
    const bt = t + active.offsetHeight;
    if (t < list.scrollTop) list.scrollTop = t;
    else if (bt > list.scrollTop + list.clientHeight) list.scrollTop = bt - list.clientHeight;
    const l = active.offsetLeft;
    const r = l + active.offsetWidth;
    if (l < list.scrollLeft) list.scrollLeft = l;
    else if (r > list.scrollLeft + list.clientWidth) list.scrollLeft = r - list.clientWidth;
  }
}
