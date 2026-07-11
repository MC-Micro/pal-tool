# Palworld Passives PWA v1.0.0

Eine leichte, installierbare und offlinefähige Palworld-Passives-Datenbank für Breeding und Buildplanung.

## Aktueller Umfang

- 102 Passives
- deutsche und englische Namen
- deutsche und englische Effekte
- verständliche Erklärungen
- Rang- und Statusanzeige
- rollenabhängige Prioritäten
- Multi-Rollen-Filter
- Top-Passives-Sortierung
- installierbare PWA mit Offline-Cache

## Dateien

- `index.html` – Einstiegspunkt und Oberfläche
- `app.css` – responsives Layout und Design
- `app.js` – Suche, Filter, Sortierung und Kartenlogik
- `data-passives.js` – vollständige Passives-Datenbasis
- `data-overrides.js` – geprüfte Korrekturen und stabile v1.0.0-Metadaten
- `manifest.webmanifest` – Installationsdaten der PWA
- `sw.js` – Offline-Cache
- `icon-192.png` und `icon-512.png` – App-Icons
- `scripts/validate-data.mjs` – automatische Daten- und Strukturprüfung
- `.github/workflows/validate.yml` – GitHub-Actions-Validierung
- `docs/ROADMAP.md` – Ausbauplan für Pals, Partnerfähigkeiten, Favoriten und Buildplanung

## Nutzung

Die veröffentlichte GitHub-Pages-Seite kann in Chrome oder Safari geöffnet und über „App installieren“ beziehungsweise „Zum Home-Bildschirm“ als PWA installiert werden.

Nach dem ersten vollständigen Laden funktioniert die App auch offline. Bei einer neuen App-Version sollte der Cache-Name in `sw.js` erhöht werden.

## Entwicklung

Das Projekt verwendet bewusst keine Frameworks, Paketmanager oder externen Laufzeitabhängigkeiten. Es besteht aus HTML, CSS und Vanilla JavaScript.

Lokale Prüfung:

```bash
node scripts/validate-data.mjs
```

Die gleiche Prüfung läuft automatisch bei Pushes und Pull Requests über GitHub Actions.

## Datenregeln

- keine erfundenen Prozentwerte
- deutsche Ingame-Namen müssen korrekt sein
- Rollenprioritäten gelten nur für den jeweiligen Einsatzbereich
- Tradeoff-Traits dürfen positive und negative Rollenbewertungen gleichzeitig besitzen
- reine Negativtraits werden separat unter `Negativ / Meiden` geführt
- echte Spieländerungen werden als `Geändert` markiert
- Korrekturen zuvor falscher Tool-Daten werden als `Korrigiert` markiert
- Quellen werden für Recherche und Wartung genutzt, aber nicht in der App-Oberfläche angezeigt

## Nächste Ausbaustufe

Das Projekt soll später um Pal-Daten, Partnerfähigkeiten mit Stufenwerten, Favoriten und einen Build-Planer erweitert werden. Die geplante Architektur steht in [`docs/ROADMAP.md`](docs/ROADMAP.md).
