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

## Tests

```bash
node --test
```

## Aufbau

Siehe [PLAN.md](PLAN.md).
