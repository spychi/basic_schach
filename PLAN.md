# Bauhaus Schach – Umsetzungsplan

Schach-App im Browser, **ohne Frameworks und ohne Build-Schritt**: reines HTML, CSS und JavaScript (ES-Module).
Design-Vorlage: [Bauhaus Schach (Canvas)](https://claude.ai/artifact/MBn7BhQ5ESYhbMCbxwWC6C). Alle Werte, die man zum Bauen braucht, stehen unten unter „Design-Spezifikation“. Subagenten müssen das Canvas also nicht öffnen.

**So wird der Plan benutzt**
- Ein Orchestrator (die Haupt-Session) arbeitet die Phasen der Reihe nach ab.
- Pakete in derselben Phase sind unabhängig und laufen **parallel** als eigene Subagenten.
- Jedes Paket hat feste Dateien, eine Schnittstelle und Abnahmekriterien. Ein Paket ist erst fertig, wenn alle Kästchen abgehakt sind.
- Abhaken: `- [ ]` → `- [x]`. Das macht der Orchestrator, nachdem er das Ergebnis geprüft hat, nicht der Subagent selbst.

---

## Fortschritt

- [x] Phase 0 – Grundgerüst
- [x] Phase 1 – Regeln, Brett-Oberfläche, Bedienelemente (parallel)
- [x] Phase 2 – Spielverlauf mit Notation, Computergegner (parallel)
- [x] Phase 3 – Zusammenbau
- [ ] Phase 4 – Prüfung und Feinschliff

---

## Technische Leitplanken (gelten für alle Pakete)

- Keine Abhängigkeiten, kein npm, kein Bundler. Einzige Ausnahme: die Schrift **Jost** über Google Fonts.
- JavaScript als ES-Module (`<script type="module">`), moderne Browser (aktuelle Chrome-, Firefox- und Safari-Versionen).
- Starten mit einem einfachen Webserver, weil ES-Module und Web Worker nicht über `file://` laufen:
  ```bash
  python3 -m http.server 8000
  ```
- Tests mit dem eingebauten Test-Runner von Node (`node --test`), ohne Bibliotheken. Getestet wird nur Logik ohne DOM (`js/engine`, `js/ai`).
- Sprache der Oberfläche: Deutsch. Code, Bezeichner und Kommentare: Englisch.
- Der Engine-Code (`js/engine`, `js/ai`) greift nie auf das DOM zu, damit er in Node und im Worker läuft.
- Farben, Abstände und Schrift kommen nur aus `css/tokens.css` (CSS-Variablen), nie als feste Werte in anderen Dateien.
- Barrierefreiheit: echte `<button>`-Elemente, sichtbarer Fokus, `aria-label` an Knöpfen, die nur ein Symbol zeigen, Bedienung per Tastatur möglich.

## Dateistruktur

```
index.html
css/
  tokens.css        Farben, Schrift, Abstände (Phase 0)
  base.css          Reset, Typografie, Knöpfe (Phase 0)
  board.css         Brett, Felder, Markierungen (P1-B)
  game.css          Layout der Partie, Desktop und Mobil (P1-B)
  newgame.css       Bildschirm „Neues Spiel“ (P1-C)
  dialog.css        Dialoge: Umwandlung, Spielende, Remis (P1-C)
js/
  main.js           Einstieg, startet App (Phase 0, wird in P3 gefüllt)
  app.js            Steuerung, Wechsel zwischen den Bildschirmen (P3)
  store.js          Speichern und Laden über localStorage (P1-C)
  engine/
    board.js        Darstellung der Stellung, FEN, Feld-Hilfen (Phase 0)
    moves.js        Zuggenerierung, legale Züge, Zug ausführen (P1-A)
    rules.js        Schach, Matt, Patt, Remisregeln (P1-A)
    notation.js     Deutsche Kurznotation (SAN) (P2-D)
    game.js         Klasse Game: Verlauf, Rückgängig, Status (P2-D)
  ai/
    evaluate.js     Bewertung einer Stellung (P2-E)
    search.js       Alpha-Beta-Suche (P2-E)
    worker.js       Web Worker für die Suche (P2-E)
  ui/
    pieces.js       SVG-Figuren (P1-B)
    board-view.js   Brett zeichnen und bedienen (P1-B)
    panel.js        Spielerleisten, Status, Zugliste, Aktionen (P1-B)
    clock.js        Schachuhr (P1-C)
    newgame-view.js Bildschirm „Neues Spiel“ (P1-C)
    dialog.js       Dialoge (P1-C)
tests/
  board.test.js, moves.test.js, rules.test.js, notation.test.js, game.test.js, ai.test.js
```

---

## Gemeinsame Schnittstellen (verbindlich)

Diese Verträge erlauben paralleles Arbeiten. Wer davon abweichen muss, meldet das dem Orchestrator, statt die Schnittstelle stillschweigend zu ändern.

### Stellung (`js/engine/board.js`)

```js
// Feld-Index 0..63: 0 = a8, 7 = h8, 56 = a1, 63 = h1 (Reihe für Reihe von oben gesehen, Weiß unten)
// Figur: 'P','N','B','R','Q','K' für Weiß, Kleinbuchstaben für Schwarz, null für leer
/** @typedef {{
 *   board: (string|null)[],          // Länge 64
 *   turn: 'w'|'b',
 *   castling: { K: boolean, Q: boolean, k: boolean, q: boolean },
 *   ep: number|null,                 // En-passant-Zielfeld
 *   halfmove: number,                // für die 50-Züge-Regel
 *   fullmove: number
 * }} State */

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export function parseFEN(fen) {}      // -> State, wirft Error bei ungültiger FEN
export function toFEN(state) {}       // -> string
export function squareName(index) {}  // 0 -> 'a8'
export function squareIndex(name) {}  // 'e4' -> 36
export function colorOf(piece) {}     // 'w' | 'b' | null
export function cloneState(state) {}
```

### Züge (`js/engine/moves.js`)

```js
/** @typedef {{
 *   from: number, to: number,
 *   piece: string,                   // bewegte Figur, z. B. 'P'
 *   captured: string|null,
 *   promotion: 'Q'|'R'|'B'|'N'|'q'|'r'|'b'|'n'|null,
 *   flags: ''|'double'|'ep'|'castle-k'|'castle-q'
 * }} Move */

export function generateLegalMoves(state) {}        // -> Move[]
export function legalMovesFrom(state, square) {}    // -> Move[]
export function makeMove(state, move) {}            // -> neuer State, das Original bleibt unverändert
export function isSquareAttacked(state, square, byColor) {}
export function perft(state, depth) {}              // -> Anzahl Blattknoten, für Tests
```

### Regeln (`js/engine/rules.js`)

```js
export function isInCheck(state, color) {}          // -> boolean
export function kingSquare(state, color) {}         // -> number
/** positionKeys: Liste der bisherigen Stellungsschlüssel (FEN ohne Zugzähler), für dreifache Wiederholung */
export function getStatus(state, positionKeys) {}
// -> { type: 'playing' }
//  | { type: 'checkmate', winner: 'w'|'b' }
//  | { type: 'stalemate' }
//  | { type: 'draw', reason: 'fifty-move'|'threefold'|'insufficient-material' }
export function positionKey(state) {}
```

### Spiel (`js/engine/game.js`, `js/engine/notation.js`)

```js
export function toSAN(state, move) {}   // deutsche Kurznotation: K D T L S, 'O-O', 'exd5', 'e8=D+', 'Sbxd2', '#' bei Matt

export class Game extends EventTarget {    // feuert 'change' nach jedem play/undo/load
  constructor(fen = START_FEN) {}
  get state() {}                           // aktueller State
  get turn() {}                            // 'w' | 'b'
  get history() {}                         // [{ move, san, fenBefore, fenAfter }]
  get lastMove() {}                        // Move | null
  legalMoves() {}
  legalMovesFrom(square) {}
  play({ from, to, promotion }) {}         // -> Eintrag im Verlauf oder null, wenn der Zug illegal ist
  undo() {}                                // nimmt einen Halbzug zurück, gibt ihn zurück oder null
  status() {}                              // wie getStatus, zusätzlich { type:'resigned', winner } | { type:'timeout', winner } | { type:'agreed-draw' }
  resign(color) {}
  agreeDraw() {}
  timeout(color) {}                        // Zeit abgelaufen. Remis, wenn der Gegner kein Mattmaterial hat
  toJSON() {}                              // { startFen, moves: ['e2e4', ...], result }
  static fromJSON(data) {}
}
```

### Computergegner (`js/ai/worker.js`)

```js
// Nachricht an den Worker:  { type: 'search', fen: string, level: 1|2|3|4|5, id: number }
// Antwort vom Worker:       { type: 'bestmove', id: number, move: { from, to, promotion } }
// Abbrechen:                { type: 'stop' }
```

### Oberfläche (`js/ui/*`)

```js
// board-view.js
export class BoardView {
  constructor(container, { onMoveIntent }) {}  // onMoveIntent({ from, to }) – wenn der Spieler einen Zug macht
  render({
    state,                    // State
    selected,                 // number|null
    targets,                  // [{ square, capture: boolean }]
    lastMove,                 // { from, to } | null
    checkSquare,              // number|null
    flipped,                  // boolean: Schwarz unten
    interactive               // boolean: false, während der Computer rechnet oder nach Spielende
  }) {}
}
// Auswahl und Zielfelder hält der Controller (app.js), nicht BoardView.
// BoardView meldet nur Klicks: onSquareClick(square), Drag&Drop als onMoveIntent.

// pieces.js
export function pieceSVG(piece) {}  // 'N' -> SVG-String mit role="img" und aria-label

// panel.js
export class Panel {
  constructor(root, { onUndo, onFlip, onDrawOffer, onResign, onNewGame }) {}
  render({ players, turn, moveNumber, history, status, captured, clocks, opening }) {}
}

// clock.js
export class Clock extends EventTarget {    // feuert 'tick' und 'timeout' (detail: color)
  constructor({ initialMs, incrementMs }) {}
  start(color) {}  switchTo(color) {}  pause() {}  remaining(color) {}
  static format(ms) {}                       // '09:12', unter 10 s: '0:08.4'
}

// dialog.js
export function choosePromotion(color) {}    // -> Promise<'Q'|'R'|'B'|'N'>
export function showGameOver({ title, detail }) {}  // -> Promise<'new'|'review'>
export function confirm({ title, text, okLabel, cancelLabel }) {} // -> Promise<boolean>

// newgame-view.js
export class NewGameView {
  constructor(root, { onStart, onBack }) {}
  // onStart({ mode: 'ai'|'local', color: 'w'|'b'|'random', level: 1..5, time: { initialMs, incrementMs } | null })
}
```

---

## Design-Spezifikation (aus dem Canvas)

### Farben (`css/tokens.css`)

| Token | Wert | Verwendung |
|---|---|---|
| `--paper` | `#F1EADC` | Hintergrund, helle Felder, weiße Figuren |
| `--ink` | `#141414` | Text, Rahmen, schwarze Figuren |
| `--blue` | `#1F4E9C` | dunkle Felder, Stärke-Stufen |
| `--yellow` | `#F2BE22` | gewählte Figur, laufende Uhr, aktive Auswahl, letzter Zug in der Zugliste |
| `--red` | `#C8291F` | Hauptknopf, letzter Zug (Ecke), Schach, Aufgeben |
| `--muted` | `#5A554C` | Nebentext |
| `--row-alt` | `#E9E1D0` | jede zweite Zeile der Zugliste |

Formregeln: keine Rundungen (außer Kreisen), keine Schatten, keine Verläufe. Rahmen 3 px, Brettrahmen 6 px, Trennlinie unter dem Kopf 6 px. Abstände im 8-px-Raster.

### Schrift

Jost (Google Fonts, Gewichte 400/500/600/700).
- Große Überschrift: 42–64 px, 700, Großbuchstaben
- Abschnittstitel: 18 px (14 px in Formularen), 700, Großbuchstaben, Sperrung 0.18em
- Fließtext und Zugliste: 17 px, 400/600
- Uhren: 28 px (mobil 22 px), 600, `font-variant-numeric: tabular-nums`
- Feldkoordinaten: 12 px, 700, innen in der Feldecke (Ziffern oben links in der a-Linie, Buchstaben unten rechts in der 1. Reihe)

### Figuren (SVG, `viewBox="0 0 100 100"`)

Weiß: Füllung `--paper`, Kontur `--ink`. Schwarz: Füllung `--ink`, Kontur `--paper`. Konturstärke 3.5, `stroke-linejoin="miter"`. „Konturfarbe“ heißt unten die jeweils andere Farbe.

| Figur | Geometrie |
|---|---|
| König | `<polygon points="44,10 56,10 56,20 66,20 66,32 56,32 56,46 72,46 72,86 28,86 28,46 44,46 44,32 34,32 34,20 44,20">` |
| Dame | Kreis `cx=50 cy=59 r=27` + Kreis `cx=50 cy=20 r=9` + gefüllter Kreis `cx=50 cy=59 r=8` in Konturfarbe |
| Turm | Rechteck `x=26 y=30 w=48 h=56` + gefülltes Rechteck `x=26 y=30 w=48 h=12` in Konturfarbe |
| Läufer | `<polygon points="50,12 78,86 22,86">` + Linie `42,50 → 60,68` (Stärke 4) in Konturfarbe |
| Springer | `<polygon points="26,86 26,14 76,14 76,42 52,42 52,86">` + gefüllter Kreis `cx=40 cy=28 r=5` in Konturfarbe |
| Bauer | Kreis `cx=50 cy=44 r=16` + Rechteck `x=32 y=64 w=36 h=22` |

Die Figur sitzt mit 7 % Abstand zum Feldrand im Feld.

### Brett und Feldzustände

- Brett: CSS-Grid 8×8, `aspect-ratio: 1`, Rahmen 6 px `--ink`. Helle Felder `--paper`, dunkle `--blue` (später in den Einstellungen wählbar).
- **Ausgewählt:** Feld wird `--yellow`.
- **Möglicher Zug:** Punkt mittig, 26 % der Feldbreite, `--ink` auf hellen und `--paper` auf dunklen Feldern.
- **Schlagen:** Ring, Abstand 4 % zum Feldrand, 5 px, gleiche Farbregel wie beim Punkt.
- **Letzter Zug:** rotes Dreieck in der Ecke oben rechts, 30 % der Feldbreite, auf Start- und Zielfeld.
- **Schach:** roter Kreis hinter dem König, Abstand 6 % zum Feldrand.

### Bildschirme

1. **Partie Desktop** (ab 900 px Breite): Kopf mit Logo (roter Kreis, blaues Quadrat, gelbes Dreieck, schwarzer Viertelkreis) und Wortmarke „SCHACH“, rechts die Knöpfe „Neues Spiel“ (rot) und Einstellungen. Darunter zweispaltig: links das Brett (max. 760 px) mit den Spielerleisten darüber und darunter, rechts der Statusblock (schwarz, „WEISS AM ZUG“, gelbes „Zug 9“), die Zugliste mit dem Namen der Eröffnung und vier Aktionsknöpfe im 2×2-Raster.
2. **Partie Mobil** (unter 900 px): Kopf mit Menüknopf, schwarzer Statusbalken, Gegnerleiste, Brett in voller Breite, eigene Leiste, die letzten Züge als waagrecht scrollende Chips, unten eine Leiste mit vier Aktionen (Zurück, Drehen, Remis, Aufgeben).
3. **Neues Spiel:** links ein blaues Plakat mit gelbem Kreis, rotem Quadrat, schwarzem Balken, großem König und Springer und „SCHACH“ in Papierfarbe. Rechts das Formular: Modus (Gegen Computer / Zwei Spieler), Farbe (Weiß / Zufall / Schwarz), Spielstärke 1–5, Bedenkzeit (Ohne, 3+2, 5+0, 10+0, 15+10) und der rote Knopf „Partie starten“. Mobil liegt das Plakat als niedriger Streifen oben.
4. **Dialoge** (nicht im Canvas, im selben Stil bauen): Rahmen 6 px `--ink`, Fläche `--paper`, Titel in Großbuchstaben. Umwandlung: vier Figuren als große Knöpfe. Spielende: Titel wie „SCHACHMATT“, „PATT“, „REMIS“, „ZEIT ABGELAUFEN“, darunter der Gewinner, Knöpfe „Neues Spiel“ (rot) und „Partie ansehen“.

---

## Phase 0 – Grundgerüst

> Ein Subagent. Ohne diese Phase kann nichts parallel laufen.

### P0 · Projektgerüst, Design-Tokens, Stellung

**Dateien:** `index.html`, `css/tokens.css`, `css/base.css`, `js/main.js`, `js/engine/board.js`, `tests/board.test.js`, `README.md`

**Aufgabe**
- [x] Dateistruktur wie oben anlegen (Abweichung: keine Platzhalter-Module, jedes Paket legt seine Dateien selbst an; zusätzlich `package.json` mit `"type": "module"`)
- [x] `index.html`: Jost laden, alle CSS-Dateien einbinden, drei leere Bildschirm-Container (`#screen-game`, `#screen-newgame`, `#dialog-root`), `js/main.js` als Modul
- [x] `css/tokens.css` mit allen Tokens aus der Design-Spezifikation (Farben, Schriftgrößen, Rahmen, Abstände)
- [x] `css/base.css`: Reset, Grundschrift, Klassen für Knöpfe (`.btn`, `.btn--primary`, `.btn--danger`, `.btn--selected`, `.icon-btn`), sichtbarer Fokusrahmen (4 px `--yellow` mit 2 px `--ink`)
- [x] `js/engine/board.js` vollständig umsetzen (parseFEN, toFEN, squareName, squareIndex, colorOf, cloneState)
- [x] `tests/board.test.js`: FEN hin und zurück für Startstellung und 3 weitere Stellungen, ungültige FEN wirft Fehler
- [x] `README.md`: Starten (`python3 -m http.server 8000`) und Tests (`node --test`)

**Abnahme**
- [x] `node --test` läuft grün
- [x] `index.html` lädt ohne Konsolenfehler, Hintergrund ist `--paper`

---

## Phase 1 – parallel

> Drei Subagenten gleichzeitig. Jeder fasst nur seine eigenen Dateien an.

### P1-A · Regeln und Zuggenerierung

**Dateien:** `js/engine/moves.js`, `js/engine/rules.js`, `tests/moves.test.js`, `tests/rules.test.js`
**Braucht:** P0 (`board.js`)

**Aufgabe**
- [x] Pseudo-legale Züge für alle Figuren, danach Filter auf legale Züge (eigener König darf nicht im Schach stehen)
- [x] Rochade kurz und lang: Rechte, leere Felder, König steht nicht im Schach, zieht nicht durch und nicht auf ein bedrohtes Feld
- [x] En passant inklusive Fesselung auf der Reihe (Sonderfall: König und Turm auf derselben Reihe)
- [x] Umwandlung in D, T, L, S (je ein eigener Zug)
- [x] `makeMove` ändert das Original nicht und pflegt Rochaderechte (auch wenn ein Turm geschlagen wird), En-passant-Feld, Halbzug- und Zugzähler
- [x] `isInCheck`, `getStatus`: Matt, Patt, 50-Züge-Regel, dreifache Wiederholung, ungenügendes Material (K–K, K+L–K, K+S–K, K+L–K+L mit Läufern auf gleichfarbigen Feldern)
- [x] Perft-Tests:
  - Startstellung: Tiefe 1 = 20, 2 = 400, 3 = 8 902, 4 = 197 281
  - `r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1`: Tiefe 1 = 48, 2 = 2 039, 3 = 97 862
  - `8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1`: Tiefe 1 = 14, 2 = 191, 3 = 2 812, 4 = 43 238
- [x] Tests für Matt (Schäfermatt), Patt, alle Remisarten

**Abnahme**
- [x] Alle Perft-Werte stimmen
- [x] Perft Startstellung Tiefe 4 dauert in Node unter 3 Sekunden

### P1-B · Figuren, Brett und Partie-Ansicht

**Dateien:** `js/ui/pieces.js`, `js/ui/board-view.js`, `js/ui/panel.js`, `css/board.css`, `css/game.css`, `dev/board-demo.html`
**Braucht:** P0 (`board.js` für `parseFEN`). Keine Abhängigkeit zu den Regeln: Zielfelder bekommt die Ansicht von außen.

**Aufgabe**
- [x] `pieceSVG(piece)` genau nach der Figuren-Tabelle
- [x] `BoardView`: 64 Felder als `<button>` mit `aria-label` („e4, Springer Weiß“), Koordinaten innen, alle Feldzustände aus der Spezifikation, `flipped` dreht das Brett
- [x] Bedienung: Klick auf Figur, dann Klick aufs Ziel. Zusätzlich Drag&Drop mit Pointer Events (Maus und Touch). Tastatur: Pfeiltasten bewegen den Fokus, Enter oder Leertaste wählt aus
- [x] Kurze Animation beim Ziehen (150 ms, `transform`), abschaltbar über `prefers-reduced-motion`
- [x] `Panel`: Spielerleisten (Name, Farbe, Stufe, geschlagene Figuren, Uhr; laufende Uhr gelb), Statusblock, Zugliste (Zeilen abwechselnd hinterlegt, letzter Zug gelb, scrollt automatisch nach unten), Aktionsknöpfe. Bei Zeitkontrolle „Ohne“ werden keine Uhren angezeigt
- [x] `css/game.css`: Desktop- und Mobil-Layout wie in der Spezifikation, Wechsel bei 900 px, keine waagrechte Scrollleiste ab 320 px Breite
- [x] `dev/board-demo.html`: zeigt die Beispielstellung aus dem Canvas (FEN `r1bqk2r/ppp2ppp/2n2n2/3p4/2BPP3/5N2/PP1N1PPP/R2QK2R w KQkq d6 0 9`, Läufer c4 ausgewählt, Zielfelder a6, b5, b3, d3, e2, f1, Schlagen auf d5, letzter Zug d7–d5) mit Dummy-Daten für das Panel

**Abnahme**
- [x] `dev/board-demo.html` sieht auf Desktop und bei 390 px Breite aus wie die Artboards „Partie – Desktop“ und „Partie – Mobil“
- [x] Brett ist komplett per Tastatur bedienbar

### P1-C · Neues Spiel, Dialoge, Uhr, Speichern

**Dateien:** `js/ui/newgame-view.js`, `js/ui/dialog.js`, `js/ui/clock.js`, `js/store.js`, `css/newgame.css`, `css/dialog.css`, `dev/newgame-demo.html`
**Braucht:** P0. Für die Figuren im Plakat und im Umwandlungsdialog: `pieceSVG` aus P1-B. Solange P1-B nicht fertig ist, einen Platzhalter nutzen und später auf den Import umstellen.

**Aufgabe**
- [x] `NewGameView` wie Artboard „Neues Spiel“. Auswahlgruppen als Knöpfe mit `aria-pressed`, Pfeiltasten wechseln innerhalb einer Gruppe. Bei „Zwei Spieler“ werden Farbe und Spielstärke ausgeblendet
- [x] Die letzte Auswahl wird gespeichert und beim nächsten Mal vorbelegt
- [x] `dialog.js` mit `<dialog>`-Element: Umwandlung, Spielende, Bestätigen. Fokus bleibt im Dialog, Esc schließt (außer bei der Umwandlung)
- [x] `Clock`: genau über `performance.now()`, Inkrement nach jedem Zug, `timeout`-Event, Anzeige unter 10 s mit Zehnteln
- [x] `store.js`: `saveGame(json)`, `loadGame()`, `clearGame()`, `saveSettings(obj)`, `loadSettings()`. Jeder Zugriff in `try/catch`, bei Fehlern still weiterlaufen

**Abnahme**
- [x] `dev/newgame-demo.html` entspricht dem Artboard, Plakat stapelt sich bei 390 px oben
- [x] Dialoge sind per Tastatur bedienbar, Bildschirmleser lesen den Titel vor (`aria-labelledby` auf den Titel)

---

## Phase 2 – parallel

> Zwei Subagenten. Beide brauchen P1-A.

### P2-D · Notation und Spielverlauf

**Dateien:** `js/engine/notation.js`, `js/engine/game.js`, `js/engine/openings.js`, `tests/notation.test.js`, `tests/game.test.js`

**Aufgabe**
- [x] `toSAN` mit deutschen Buchstaben (K, D, T, L, S), Eindeutigkeit über Linie oder Reihe (`Sbd2`, `T1e2`), `x` beim Schlagen, `O-O` / `O-O-O`, `=D` bei Umwandlung, `+` bei Schach, `#` bei Matt
- [x] Klasse `Game` gemäß Schnittstelle, inklusive Stellungsschlüsseln für die Wiederholung
- [x] `toJSON` / `fromJSON`: Partie lässt sich nach dem Neuladen genau wiederherstellen
- [x] `openings.js`: kleine Tabelle mit ca. 30 bekannten Eröffnungen (Zugfolge → deutscher Name, z. B. „Italienische Partie“, „Sizilianische Verteidigung“, „Damengambit“). Funktion `openingName(sanList)` liefert den längsten Treffer
- [x] Tests: die Beispielpartie aus dem Canvas ergibt genau `e4 e5 Sf3 Sc6 Lc4 Lc5 c3 Sf6 d4 exd4 cxd4 Lb4+ Ld2 Lxd2+ Sbxd2 d5`. Dazu Tests für Rochade, Umwandlung mit Schach, Eindeutigkeit und Matt

**Abnahme**
- [x] Alle Tests grün

### P2-E · Computergegner

**Dateien:** `js/ai/evaluate.js`, `js/ai/search.js`, `js/ai/worker.js`, `tests/ai.test.js`

**Aufgabe**
- [x] Bewertung: Materialwerte (B 100, S 320, L 330, T 500, D 900) und Feldtabellen pro Figur, für den König getrennt nach Mittel- und Endspiel
- [x] Negamax mit Alpha-Beta, Zugsortierung (Schlagzüge nach dem Schema „wertvolles Opfer, billiger Angreifer“ zuerst), Ruhesuche (nur Schlagzüge), iterative Vertiefung mit Zeitlimit
- [x] Stufen:

  | Stufe | Tiefe | Zeitlimit | Zufall |
  |---|---|---|---|
  | 1 | 1 | 200 ms | stark (oft nicht der beste Zug) |
  | 2 | 2 | 400 ms | mittel |
  | 3 | 3 | 800 ms | leicht |
  | 4 | 4 | 1,5 s | keiner |
  | 5 | bis 6 | 3 s | keiner |

- [x] `worker.js` als Modul-Worker gemäß Nachrichten-Vertrag. `stop` bricht ab und liefert den besten bisher gefundenen Zug
- [x] Tests: findet Matt in 1 auf Stufe 3+, schlägt eine ungedeckte Dame, gibt in jeder Teststellung einen legalen Zug zurück

**Abnahme**
- [x] Stufe 5 antwortet in Mittelspielstellungen in höchstens 3,5 s
- [x] Alle Tests grün

---

## Phase 3 – Zusammenbau

> Ein Subagent. Braucht alle vorherigen Pakete.

### P3 · Steuerung (`js/app.js`, `js/main.js`)

**Aufgabe**
- [x] Ablauf beim Start: gespeicherte Partie vorhanden → Partie fortsetzen, sonst Bildschirm „Neues Spiel“
- [x] Zug durch den Spieler: Auswahl → Zielfelder aus `game.legalMovesFrom` → bei Umwandlung `choosePromotion` → `game.play` → Ansicht aktualisieren, speichern, Uhr umschalten
- [x] Gegen Computer: nach dem Zug des Spielers den Worker fragen, solange ist das Brett gesperrt und der Statusblock zeigt „Computer denkt …“. Spielt der Mensch Schwarz, beginnt der Computer
- [x] Rückgängig: gegen den Computer zwei Halbzüge (laufende Suche vorher abbrechen), lokal einer. Bei laufender Uhr nur nach Bestätigung
- [x] Brett drehen. Lokal zwei Spieler: optional automatisch nach jedem Zug (Einstellung, standardmäßig aus)
- [x] Remis anbieten: gegen den Computer nimmt er an, wenn seine Bewertung ≤ −50 aus seiner Sicht ist, sonst Meldung „Computer lehnt ab“. Lokal muss der andere Spieler bestätigen
- [x] Aufgeben mit Bestätigung
- [x] Spielende (Matt, Patt, Remis, Zeit, Aufgabe): Brett sperren, Uhr stoppen, Dialog zeigen, gespeicherte Partie löschen
- [x] „Partie ansehen“: Klick in der Zugliste oder Pfeiltasten links/rechts springen durch die Stellungen, nur ansehen
- [x] Einstellungen (Knopf im Kopf): Farbe der dunklen Felder (Blau, Rot, Grau, Schwarz wie im Canvas-Tweak), Zughinweise an/aus, Brett automatisch drehen. Gespeichert in `store`
- [x] Geschlagene Figuren und Name der Eröffnung im Panel

**Abnahme**
- [x] Eine komplette Partie gegen den Computer bis zum Matt ist spielbar (Zufallszüge gegen Stufe 1, Matt nach 25 Zügen)
- [x] Eine lokale Partie mit Uhr bis zum Zeitablauf ist spielbar (geprüft mit 1:00 + 2, Weiß auf 1,5 s gesetzt)
- [x] Neu laden mitten in der Partie stellt sie genau wieder her (Stellung, Zugliste, Restzeiten)

---

## Phase 4 – Prüfung und Feinschliff

> Zwei Subagenten parallel, beide nur lesend. Fehler meldet der Orchestrator an einen Fix-Subagenten.

### P4-a · Funktionstest im Browser
- [x] Rochade beidseitig, En passant, Umwandlung in der Oberfläche (Umwandlung mit Turm geprüft; Dame, Läufer, Springer nutzen denselben Weg)
- [x] Matt, Patt und dreifache Wiederholung lösen im Browser den richtigen Dialog aus
- [x] 50-Züge-Regel und ungenügendes Material lösen im Browser den richtigen Dialog aus
- [x] Rückgängig während der Computer rechnet
- [x] Zeitablauf bei beiden Farben
- [x] Keine Fehler in der Konsole während einer ganzen Partie

### P4-b · Design und Barrierefreiheit
- [x] Desktop (1440 px), Tablet (768 px), Handy (375 px und 320 px) gegen die Artboards vergleichen. Befund Tablet: Brett war zu groß, behoben
- [x] Farbkontraste: Text mindestens 4.5:1 (per Skript auf allen Bildschirmen und Dialogen geprüft). Befund: Brettfarbe Grau zu hell für die Koordinaten, auf `#6F685C` abgedunkelt
- [x] Ganze Partie nur mit Tastatur spielbar. Befund: Bestätigungsdialoge hatten den Fokus auf „Aufgeben“, jetzt auf der sicheren Wahl
- [x] `prefers-reduced-motion` schaltet Animationen ab (im Code geprüft: Brett-Animation fragt die Einstellung bei jedem Zug ab, CSS setzt Übergänge auf 0)
- [ ] Lighthouse: Barrierefreiheit ≥ 95 (Lighthouse ist im Vorschau-Browser nicht verfügbar. Ersatzweise per Skript geprüft: alle Knöpfe haben Namen, keine doppelten IDs, `lang="de"`, Kontraste)

### Abschluss
- [x] Alle Befunde aus P4 behoben
- [x] `node --test` grün (60 Tests)
- [x] README aktuell

---

## Anleitung für den Orchestrator

**Reihenfolge:** P0 → (P1-A ‖ P1-B ‖ P1-C) → (P2-D ‖ P2-E) → P3 → (P4-a ‖ P4-b) → Fixes.
P2-D und P2-E dürfen schon starten, sobald P1-A abgenommen ist, auch wenn P1-B oder P1-C noch laufen.

**Vorlage für den Auftrag an einen Subagenten:**

```
Du setzt Arbeitspaket <ID> aus /Users/david/felix/PLAN.md um.
Lies zuerst diese Abschnitte: „Technische Leitplanken“, „Gemeinsame Schnittstellen“,
„Design-Spezifikation“ (nur bei UI-Paketen) und dein Paket <ID>.
Fasse nur die Dateien an, die dein Paket nennt. Halte die Schnittstellen genau ein.
Wenn eine Schnittstelle nicht passt: nicht ändern, sondern im Ergebnis melden.
Hake nichts in PLAN.md ab.
Am Ende: Liste der geänderten Dateien, Testergebnis (Ausgabe von `node --test`),
offene Punkte und Abweichungen.
```

**Nach jedem Paket:** Tests selbst laufen lassen, die Abnahmekriterien prüfen (UI-Pakete im Browser ansehen), erst dann die Kästchen in dieser Datei abhaken.
