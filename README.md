# Palworld Passives PWA v1.2.0-Test

Dies ist eine erste PWA-/Mini-App-Struktur auf Basis der bisherigen HTML-Version v1.1.15.

## Dateien
- `index.html` – Einstiegspunkt
- `app.css` – Layout/Design
- `app.js` – Filter-, Sortier- und Kartenlogik
- `data-passives.js` – 102 Passives als Datenmodul
- `manifest.webmanifest` – App-Name/Icon/Installationsdaten
- `sw.js` – Offline-Cache, wenn die App über http/https läuft
- `icons/` – App-Icons

## Wichtiger Hinweis
Wenn du `index.html` direkt aus Dateien/Downloads öffnest, funktioniert die Liste als normale Web-App-Vorschau. Die echte PWA-Installation und der Offline-Cache funktionieren zuverlässig erst, wenn der Ordner über einen lokalen Webserver oder HTTPS gehostet wird.

Android/iOS: Für echtes App-Gefühl später den Ordner hosten, in Chrome/Safari öffnen und „Zum Startbildschirm hinzufügen“ nutzen.
