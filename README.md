# Bauhaus Schach

Schach im Browser im Bauhaus-Stil – reines HTML, CSS und JavaScript, ohne Frameworks und ohne Build-Schritt.

## Starten

ES-Module und Web Worker brauchen einen Webserver:

```bash
python3 -m http.server 8000
```

Dann <http://localhost:8000> öffnen.

## Mit Docker

```bash
docker compose up -d --build
```

Dann <http://localhost:8080> öffnen. Der Container liefert die Dateien mit nginx aus. Stoppen mit `docker compose down`.

### Fertiges Image aus GHCR

```bash
docker run -d -p 8080:80 --name basic_schach ghcr.io/spychi/basic_schach:latest
```

Jeder Push auf `main` baut das Image neu (`latest`), ein Tag wie `v1.0.0` erzeugt zusätzlich `1.0.0` und `1.0`. Das Image läuft auf amd64 und arm64.

## Tests

```bash
node --test
```

## Aufbau

Siehe [PLAN.md](PLAN.md).
