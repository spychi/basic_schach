// Modal dialogs built on <dialog>, plus a small toast.
import { pieceSVG } from './pieces.js';

let seq = 0;

function root() {
  return document.getElementById('dialog-root') || document.body;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/**
 * Opens a modal dialog. build(dlg, done) fills the dialog and calls done(value).
 * escValue: value for Esc; undefined = Esc disabled.
 */
function openDialog({ title, className = '', build, escValue }) {
  return new Promise((resolve) => {
    const id = 'dlg-' + (++seq);
    const dlg = el('dialog', 'dialog ' + className);
    dlg.setAttribute('aria-labelledby', id + '-title');
    const h = el('h2', 'dialog__title', title);
    h.id = id + '-title';
    dlg.appendChild(h);

    let result;
    let finished = false;
    const done = (value) => {
      if (finished) return;
      finished = true;
      result = value;
      dlg.close();
    };
    build(dlg, done);

    dlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      if (escValue !== undefined) done(escValue);
    });
    dlg.addEventListener('close', () => {
      dlg.remove();
      if (previous && previous.isConnected && typeof previous.focus === 'function') previous.focus();
      resolve(result);
    });

    const previous = document.activeElement;
    root().appendChild(dlg);
    dlg.showModal();
    const first = dlg.querySelector('[autofocus]') || dlg.querySelector('button');
    if (first) first.focus();
  });
}

function button(label, className, onClick) {
  const b = el('button', 'btn ' + className, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

/** -> Promise<'Q'|'R'|'B'|'N'>. Esc is disabled. */
export function choosePromotion(color) {
  const options = [['Q', 'Dame'], ['R', 'Turm'], ['B', 'Läufer'], ['N', 'Springer']];
  return openDialog({
    title: 'Umwandlung',
    className: 'dialog--promotion',
    build(dlg, done) {
      dlg.appendChild(el('p', 'dialog__text', 'Wähle die neue Figur.'));
      const row = el('div', 'dialog__pieces');
      for (const [letter, name] of options) {
        const b = el('button', 'btn dialog__piece');
        b.type = 'button';
        b.setAttribute('aria-label', name);
        b.title = name;
        const letterForColor = color === 'b' ? letter.toLowerCase() : letter;
        b.innerHTML = pieceSVG(letterForColor);
        const cap = el('span', 'dialog__piece-name', name);
        b.appendChild(cap);
        b.addEventListener('click', () => done(letter));
        row.appendChild(b);
      }
      dlg.appendChild(row);
    },
  });
}

/** -> Promise<'new'|'review'>. Esc = 'review'. */
export function showGameOver({ title, detail }) {
  return openDialog({
    title,
    className: 'dialog--gameover',
    escValue: 'review',
    build(dlg, done) {
      if (detail) dlg.appendChild(el('p', 'dialog__text', detail));
      const actions = el('div', 'dialog__actions');
      actions.appendChild(button('Neues Spiel', 'btn--primary', () => done('new')));
      actions.appendChild(button('Partie ansehen', '', () => done('review')));
      dlg.appendChild(actions);
    },
  });
}

/** -> Promise<boolean>. Esc = false. */
export function confirm({ title, text, okLabel = 'OK', cancelLabel = 'Abbrechen' }) {
  return openDialog({
    title,
    className: 'dialog--confirm',
    escValue: false,
    build(dlg, done) {
      if (text) dlg.appendChild(el('p', 'dialog__text', text));
      const actions = el('div', 'dialog__actions');
      actions.appendChild(button(okLabel, 'btn--primary', () => done(true)));
      // Focus the safe choice, so a stray Enter never resigns or undoes.
      const cancel = button(cancelLabel, '', () => done(false));
      cancel.autofocus = true;
      actions.appendChild(cancel);
      dlg.appendChild(actions);
    },
  });
}

let toastBox = null;
let toastTimer = null;

/** Short message, 2.5 s, announced politely to screen readers. */
export function toast(text) {
  if (!toastBox || !toastBox.isConnected) {
    toastBox = el('div', 'toast');
    toastBox.setAttribute('role', 'status');
    toastBox.setAttribute('aria-live', 'polite');
    toastBox.hidden = true;
    document.body.appendChild(toastBox);
  }
  clearTimeout(toastTimer);
  toastBox.hidden = true;
  // Re-show on the next frame so the live region announces each message.
  requestAnimationFrame(() => {
    toastBox.textContent = text;
    toastBox.hidden = false;
    toastTimer = setTimeout(() => {
      toastBox.hidden = true;
      toastBox.textContent = '';
    }, 2500);
  });
}
