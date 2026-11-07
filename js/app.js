// App controller: wires engine, AI worker, clock and views together.
import { Game } from './engine/game.js';
import { toFEN } from './engine/board.js';
import { isInCheck, kingSquare } from './engine/rules.js';
import { evaluateForSide } from './ai/evaluate.js';
import { BoardView } from './ui/board-view.js';
import { Panel } from './ui/panel.js';
import { Clock } from './ui/clock.js';
import { NewGameView } from './ui/newgame-view.js';
import { choosePromotion, showGameOver, confirm, toast } from './ui/dialog.js';
import * as store from './store.js';

const COLOR_NAME = { w: 'Weiß', b: 'Schwarz' };
const other = (c) => (c === 'w' ? 'b' : 'w');

export const BOARD_COLORS = [
  { id: 'blue', label: 'Blau', value: 'var(--blue)' },
  { id: 'red', label: 'Rot', value: 'var(--red)' },
  { id: 'gray', label: 'Grau', value: '#6F685C' },
  { id: 'black', label: 'Schwarz', value: 'var(--ink)' },
];

const DEFAULT_SETTINGS = { boardColor: 'blue', hints: true, autoFlip: false };

const DRAW_REASON = {
  'fifty-move': '50-Züge-Regel.',
  threefold: 'Dreifache Stellungswiederholung.',
  'insufficient-material': 'Zu wenig Material zum Mattsetzen.',
  'timeout-insufficient': 'Zeit abgelaufen, aber der Gegner kann nicht mehr mattsetzen.',
};

export function startApp(doc = document) {
  const app = new App(doc);
  app.init();
  return app;
}

class App {
  constructor(doc) {
    this.doc = doc;
    this.gameRoot = doc.getElementById('screen-game');
    this.newGameRoot = doc.getElementById('screen-newgame');

    this.game = null;
    this.config = null;      // { mode: 'ai'|'local', human: 'w'|'b'|null, level, time }
    this.clock = null;
    this.flipped = false;
    this.selected = null;
    this.viewPly = null;     // null = live position
    this.thinking = false;
    this.worker = null;
    this.searchId = 0;
    this.settings = { ...DEFAULT_SETTINGS, ...(store.loadSettings().app || {}) };
  }

  init() {
    this.panel = new Panel(this.gameRoot, {
      onUndo: () => this.undo(),
      onFlip: () => { this.flipped = !this.flipped; this.render(); this.save(); },
      onDrawOffer: () => this.offerDraw(),
      onResign: () => this.resign(),
      onNewGame: () => this.showNewGame(),
      onSettings: () => this.openSettings(),
      onSelectPly: (ply) => this.selectPly(ply),
    });
    this.board = new BoardView(this.panel.boardContainer, {
      onSquareClick: (sq) => this.onSquareClick(sq),
      onMoveIntent: ({ from, to }) => this.tryMove(from, to),
    });
    this.newGame = new NewGameView(this.newGameRoot, {
      onStart: (opts) => this.startGame(opts),
      onBack: () => this.showGameScreen(),
    });

    this.applySettings();
    this.doc.addEventListener('keydown', (e) => this.onKey(e));
    const persist = () => this.save();
    this.doc.addEventListener('visibilitychange', persist);
    window.addEventListener('pagehide', persist);

    if (!this.restore()) this.showNewGame();
  }

  // ---------- screens ----------

  showNewGame() {
    if (this.clock && this.isLive()) this.clock.pause();
    this.gameRoot.hidden = true;
    this.newGame.show({ canGoBack: !!this.game });
  }

  showGameScreen() {
    this.newGame.hide();
    this.gameRoot.hidden = false;
    if (this.clock && this.isLive() && !this.clock.running) this.clock.start(this.game.turn);
    this.render();
  }

  // ---------- game lifecycle ----------

  startGame({ mode, color, level, time }) {
    this.cancelThinking();
    if (this.clock) this.clock.pause();
    const human = mode === 'ai' ? (color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : color) : null;
    this.config = { mode, human, level, time };
    this.game = new Game();
    this.selected = null;
    this.viewPly = null;
    this.flipped = mode === 'ai' && human === 'b';
    this.setupClock();
    this.showGameScreen();
    this.save();
    this.maybeThink();
  }

  setupClock(times) {
    this.clock = null;
    const t = this.config.time;
    if (!t) return;
    const clock = new Clock({ initialMs: t.initialMs, incrementMs: t.incrementMs });
    if (times) clock.setTimes(times);
    clock.addEventListener('tick', () => this.renderPanel());
    clock.addEventListener('timeout', (e) => {
      if (!this.game || this.isOver()) return;
      this.cancelThinking();
      this.game.timeout(e.detail);
      this.afterGameChange();
    });
    this.clock = clock;
  }

  restore() {
    const saved = store.loadGame();
    if (!saved || !saved.game || !saved.config) return false;
    try {
      this.game = Game.fromJSON(saved.game);
    } catch {
      store.clearGame();
      return false;
    }
    this.config = saved.config;
    this.flipped = !!saved.flipped;
    this.setupClock(saved.clocks || undefined);
    this.showGameScreen();
    if (this.isOver()) {
      if (this.clock) this.clock.pause();
    } else {
      this.maybeThink();
    }
    return true;
  }

  save() {
    if (!this.game) return;
    if (this.isOver()) { store.clearGame(); return; }
    store.saveGame({
      config: this.config,
      game: this.game.toJSON(),
      clocks: this.clock ? { w: this.clock.remaining('w'), b: this.clock.remaining('b') } : null,
      flipped: this.flipped,
    });
  }

  // ---------- state helpers ----------

  isOver() { return !!this.game && this.game.status().type !== 'playing'; }
  isLive() { return !!this.game && !this.isOver(); }
  isHumanTurn() {
    return this.config.mode === 'local' || this.game.turn === this.config.human;
  }
  interactive() {
    return this.isLive() && !this.thinking && this.viewPly === null && this.isHumanTurn();
  }

  // ---------- moves ----------

  onSquareClick(sq) {
    if (!this.interactive()) {
      if (this.viewPly !== null) { this.viewPly = null; this.render(); }
      return;
    }
    const state = this.game.state;
    if (this.selected !== null && this.selected !== sq) {
      const legal = this.game.legalMovesFrom(this.selected).some((m) => m.to === sq);
      if (legal) { this.tryMove(this.selected, sq); return; }
    }
    const piece = state.board[sq];
    const own = piece && (piece === piece.toUpperCase() ? 'w' : 'b') === state.turn;
    this.selected = own && this.selected !== sq ? sq : null;
    this.render();
  }

  async tryMove(from, to) {
    if (!this.interactive()) return;
    if (!this.game.legalMovesFrom(from).some((m) => m.to === to)) {
      this.selected = null;
      this.render();
      return;
    }
    let promotion = null;
    if (this.game.needsPromotion(from, to)) {
      promotion = await choosePromotion(this.game.turn);
      if (!this.interactive()) return;
    }
    const entry = this.game.play({ from, to, promotion });
    this.selected = null;
    if (!entry) { this.render(); return; }
    this.onMovePlayed();
  }

  onMovePlayed() {
    if (this.clock && this.isLive()) this.clock.switchTo(this.game.turn);
    if (this.config.mode === 'local' && this.settings.autoFlip) this.flipped = this.game.turn === 'b';
    this.afterGameChange();
    this.maybeThink();
  }

  afterGameChange() {
    this.render();
    this.save();
    if (this.isOver()) this.finishGame();
  }

  async finishGame() {
    if (this.clock) this.clock.pause();
    this.cancelThinking();
    this.selected = null;
    store.clearGame();
    this.render();
    const { title, detail } = this.describeResult();
    const choice = await showGameOver({ title, detail });
    if (choice === 'new') this.showNewGame();
  }

  describeResult() {
    const s = this.game.status();
    const winnerText = (w) => {
      if (this.config.mode === 'ai') return w === this.config.human ? 'Du gewinnst.' : 'Der Computer gewinnt.';
      return `${COLOR_NAME[w]} gewinnt.`;
    };
    switch (s.type) {
      case 'checkmate': return { title: 'Schachmatt', detail: winnerText(s.winner) };
      case 'stalemate': return { title: 'Patt', detail: 'Remis – keine legalen Züge mehr.' };
      case 'timeout': return { title: 'Zeit abgelaufen', detail: winnerText(s.winner) };
      case 'resigned': return { title: 'Aufgegeben', detail: winnerText(s.winner) };
      case 'agreed-draw': return { title: 'Remis', detail: 'Remis vereinbart.' };
      case 'draw': return { title: 'Remis', detail: DRAW_REASON[s.reason] || 'Remis.' };
      default: return { title: '', detail: '' };
    }
  }

  // ---------- computer ----------

  ensureWorker() {
    if (this.worker) return this.worker;
    const w = new Worker(new URL('./ai/worker.js', import.meta.url), { type: 'module' });
    w.addEventListener('message', (e) => this.onWorkerMessage(e.data));
    w.addEventListener('error', () => {
      this.thinking = false;
      toast('Der Computer hat einen Fehler gemacht.');
      this.render();
    });
    this.worker = w;
    return w;
  }

  maybeThink() {
    if (!this.game || this.config.mode !== 'ai' || !this.isLive()) return;
    if (this.game.turn === this.config.human || this.thinking) return;
    this.thinking = true;
    const id = ++this.searchId;
    this.render();
    this.ensureWorker().postMessage({
      type: 'search',
      id,
      fen: toFEN(this.game.state),
      level: this.config.level,
      history: this.game._keys ? this.game._keys.slice() : [],
    });
  }

  onWorkerMessage(msg) {
    if (!msg || msg.id !== this.searchId) return;
    if (msg.type === 'error') {
      this.thinking = false;
      toast('Der Computer hat einen Fehler gemacht.');
      this.render();
      return;
    }
    if (msg.type !== 'bestmove') return;
    this.thinking = false;
    if (!msg.move || !this.isLive()) { this.render(); return; }
    const entry = this.game.play(msg.move);
    if (!entry) { this.render(); return; }
    this.onMovePlayed();
  }

  cancelThinking() {
    this.searchId++;
    if (this.thinking && this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.thinking = false;
  }

  // ---------- actions ----------

  async undo() {
    if (!this.isLive() || !this.game.history.length) return;
    if (this.clock) {
      const ok = await confirm({
        title: 'Zug zurücknehmen?',
        text: 'Die Uhr läuft weiter, die verbrauchte Zeit bleibt verbraucht.',
        okLabel: 'Zurücknehmen',
        cancelLabel: 'Abbrechen',
      });
      if (!ok || !this.isLive()) return;
    }
    this.cancelThinking();
    this.viewPly = null;
    this.selected = null;
    if (this.config.mode === 'ai') {
      let e;
      do { e = this.game.undo(); } while (e && this.game.turn !== this.config.human);
    } else {
      this.game.undo();
    }
    if (this.clock) this.clock.start(this.game.turn);
    this.render();
    this.save();
    this.maybeThink();
  }

  async offerDraw() {
    if (!this.isLive()) return;
    if (this.config.mode === 'ai') {
      if (this.thinking) return;
      const computer = other(this.config.human);
      if (evaluateForSide(this.game.state, computer) <= -50) {
        this.game.agreeDraw();
        this.afterGameChange();
      } else {
        toast('Der Computer lehnt das Remis ab.');
      }
      return;
    }
    const offering = this.game.turn;
    const ok = await confirm({
      title: 'Remis?',
      text: `${COLOR_NAME[offering]} bietet Remis an. ${COLOR_NAME[other(offering)]}, nimmst du an?`,
      okLabel: 'Annehmen',
      cancelLabel: 'Ablehnen',
    });
    if (ok && this.isLive()) {
      this.game.agreeDraw();
      this.afterGameChange();
    }
  }

  async resign() {
    if (!this.isLive()) return;
    const color = this.config.mode === 'ai' ? this.config.human : this.game.turn;
    const ok = await confirm({
      title: 'Aufgeben?',
      text: this.config.mode === 'ai' ? 'Die Partie ist dann verloren.' : `${COLOR_NAME[color]} gibt die Partie auf.`,
      okLabel: 'Aufgeben',
      cancelLabel: 'Weiterspielen',
    });
    if (!ok || !this.isLive()) return;
    this.cancelThinking();
    this.game.resign(color);
    this.afterGameChange();
  }

  selectPly(ply) {
    if (!this.game) return;
    const n = this.game.history.length;
    this.viewPly = ply >= n ? null : Math.max(0, ply);
    this.selected = null;
    this.render();
  }

  onKey(e) {
    if (!this.game || this.gameRoot.hidden) return;
    if (this.doc.querySelector('dialog[open]')) return;
    const t = e.target;
    if (t && t.closest && (t.closest('input, textarea, select') || t.closest('.board, [role="grid"]'))) {
      if (e.key === 'Escape' && this.selected !== null) { this.selected = null; this.render(); }
      return;
    }
    const n = this.game.history.length;
    const cur = this.viewPly === null ? n : this.viewPly;
    if (e.key === 'ArrowLeft') { e.preventDefault(); this.selectPly(cur - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); this.selectPly(cur + 1); }
    else if (e.key === 'Home') { e.preventDefault(); this.selectPly(0); }
    else if (e.key === 'End') { e.preventDefault(); this.selectPly(n); }
    else if (e.key === 'Escape' && this.selected !== null) { this.selected = null; this.render(); }
  }

  // ---------- settings ----------

  applySettings() {
    const c = BOARD_COLORS.find((x) => x.id === this.settings.boardColor) || BOARD_COLORS[0];
    this.doc.documentElement.style.setProperty('--square-dark', c.value);
  }

  saveSettings() {
    store.saveSettings({ app: this.settings });
    this.applySettings();
    this.render();
  }

  openSettings() {
    const doc = this.doc;
    const dlg = doc.createElement('dialog');
    dlg.className = 'dialog dialog--settings';
    dlg.setAttribute('aria-labelledby', 'settings-title');
    dlg.innerHTML = `
      <h2 class="dialog__title" id="settings-title">Einstellungen</h2>
      <fieldset class="settings__group">
        <legend class="settings__legend">Dunkle Felder</legend>
        <div class="settings__swatches">
          ${BOARD_COLORS.map((c) => `
            <button type="button" class="btn settings__swatch" data-color="${c.id}" aria-pressed="${c.id === this.settings.boardColor}">
              <span class="settings__chip" style="background:${c.value}" aria-hidden="true"></span>${c.label}
            </button>`).join('')}
        </div>
      </fieldset>
      <div class="settings__group">
        <button type="button" class="btn settings__toggle" data-toggle="hints" aria-pressed="${this.settings.hints}">Mögliche Züge anzeigen</button>
        <button type="button" class="btn settings__toggle" data-toggle="autoFlip" aria-pressed="${this.settings.autoFlip}">Brett automatisch drehen (zwei Spieler)</button>
      </div>
      <div class="dialog__actions">
        <button type="button" class="btn btn--primary" data-close>Fertig</button>
      </div>`;
    dlg.addEventListener('click', (e) => {
      const sw = e.target.closest('[data-color]');
      const tg = e.target.closest('[data-toggle]');
      if (sw) {
        this.settings.boardColor = sw.dataset.color;
        dlg.querySelectorAll('[data-color]').forEach((b) => b.setAttribute('aria-pressed', String(b === sw)));
        this.saveSettings();
      } else if (tg) {
        const key = tg.dataset.toggle;
        this.settings[key] = !this.settings[key];
        tg.setAttribute('aria-pressed', String(this.settings[key]));
        if (key === 'autoFlip' && this.config && this.config.mode === 'local' && this.settings.autoFlip) {
          this.flipped = this.game.turn === 'b';
        }
        this.saveSettings();
      } else if (e.target.closest('[data-close]')) {
        dlg.close();
      }
    });
    const prev = doc.activeElement;
    dlg.addEventListener('close', () => { dlg.remove(); if (prev && prev.focus) prev.focus(); });
    (doc.getElementById('dialog-root') || doc.body).appendChild(dlg);
    dlg.showModal();
    dlg.querySelector('button').focus();
  }

  // ---------- rendering ----------

  render() {
    if (!this.game || this.gameRoot.hidden) return;
    const g = this.game;
    const review = this.viewPly !== null;
    const state = review ? g.stateAt(this.viewPly) : g.state;
    const lastMove = review
      ? (this.viewPly > 0 ? g.history[this.viewPly - 1].move : null)
      : g.lastMove;

    let targets = [];
    if (this.selected !== null && this.settings.hints && !review) {
      const seen = new Set();
      for (const m of g.legalMovesFrom(this.selected)) {
        if (seen.has(m.to)) continue;
        seen.add(m.to);
        targets.push({ square: m.to, capture: !!m.captured });
      }
    }

    this.board.render({
      state,
      selected: review ? null : this.selected,
      targets,
      lastMove: lastMove ? { from: lastMove.from, to: lastMove.to } : null,
      checkSquare: isInCheck(state, state.turn) ? kingSquare(state, state.turn) : null,
      flipped: this.flipped,
      interactive: this.interactive(),
    });
    this.renderPanel();
  }

  renderPanel() {
    if (!this.game || this.gameRoot.hidden) return;
    const g = this.game;
    const cfg = this.config;
    const review = this.viewPly !== null;
    const state = review ? g.stateAt(this.viewPly) : g.state;
    const over = this.isOver();

    let players;
    if (cfg.mode === 'ai') {
      const comp = other(cfg.human);
      players = {
        [cfg.human]: { name: 'Du', subtitle: COLOR_NAME[cfg.human] },
        [comp]: { name: 'Computer', subtitle: `${COLOR_NAME[comp]} · Stufe ${cfg.level}` },
      };
    } else {
      players = {
        w: { name: 'Spieler 1', subtitle: 'Weiß' },
        b: { name: 'Spieler 2', subtitle: 'Schwarz' },
      };
    }

    let statusText;
    if (over) statusText = this.describeResult().title;
    else if (review) statusText = 'Rückblick';
    else if (this.thinking) statusText = 'Computer denkt …';
    else statusText = `${COLOR_NAME[g.turn]} am Zug`;

    const humanMoves = cfg.mode === 'ai'
      ? g.history.length >= (cfg.human === 'w' ? 1 : 2)
      : g.history.length > 0;

    this.panel.render({
      players,
      bottomColor: this.flipped ? 'b' : 'w',
      turn: state.turn,
      moveNumber: state.fullmove,
      statusText,
      history: g.history.map((h) => ({ san: h.san })),
      currentPly: review ? this.viewPly : null,
      captured: g.captured(),
      clocks: this.clock
        ? { w: this.clock.remaining('w'), b: this.clock.remaining('b'), running: over ? null : this.clock.running }
        : null,
      opening: g.openingName(),
      canUndo: !over && humanMoves && !review,
      gameOver: over,
    });
  }
}
