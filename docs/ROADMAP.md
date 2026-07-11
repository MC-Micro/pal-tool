# Paldex-Projekt – Ausbauplan

## Ausgangspunkt

Version 1.0.0 ist die stabile, installierbare und offlinefähige Passives-PWA. Sie bleibt leichtgewichtig und verwendet weiterhin HTML, CSS und Vanilla JavaScript ohne Paketabhängigkeiten.

## Zielmodule

### 1. Passives

- deutsche und englische Namen
- exakte Effekte
- verständliche Erklärungen
- Rang, Status, Rollen und Prioritäten
- Filter, Suche und Top-Passives

### 2. Pals

Geplante Datenstruktur:

```js
{
  id: 100,
  name_de: 'Anubis',
  name_en: 'Anubis',
  partner_skill_id: 'guardian-of-the-desert'
}
```

### 3. Partnerfähigkeiten

Partnerfähigkeiten werden getrennt von Pals gespeichert, damit eine Fähigkeit mehrere Stufen und strukturierte Effekte besitzen kann.

```js
{
  id: 'guardian-of-the-desert',
  name_de: '...',
  name_en: '...',
  pal_ids: [100],
  effects: [
    {
      level: 1,
      value: 5,
      unit: '%',
      category: 'Spieler / Angriff'
    }
  ]
}
```

Geplante Funktionen:

- Partnerfähigkeit nach Effekt durchsuchen
- Werte und Skalierung je Stufe anzeigen
- zugehörige Pals ausgeben
- Kategorien und Effektivität filtern

### 4. Favoriten und Besitzstand

Lokale Speicherung zunächst über IndexedDB oder localStorage:

```js
{
  favorites: [],
  ownedPassives: [],
  ownedPals: [],
  plannedBuilds: []
}
```

Geplante Markierungen:

- Favorit
- bereits vorhanden
- noch benötigt
- Zuchtziel
- eigener Hinweis

### 5. Build-Planer

Der Build-Planer soll Passives, Partnerfähigkeiten und Pals kombinieren.

Beispiele:

- Kampfbuild aus Angriff und Defensive/Tank
- Mountbuild aus Speed und Ausdauer
- Base-Arbeiter mit Arbeit, Versorgung und Nachtbetrieb
- Auswahl einer Partnerfähigkeit und Anzeige geeigneter Pals

## Vorgesehene Datenstruktur

Bei wachsendem Datenumfang sollen die Module getrennt werden:

```text
data/
  passives.js
  partner-skills.js
  pals.js
  categories.js
```

Die bestehende `data-passives.js` bleibt zunächst erhalten. Die spätere Migration erfolgt erst zusammen mit dem ersten neuen Datenmodul, damit Version 1.0.0 nicht unnötig umgebaut wird.

## Qualitätsregeln

- keine erfundenen Prozentwerte
- deutsche Ingame-Namen müssen exakt sein
- echte Spieländerungen und reine Datenkorrekturen bleiben getrennt
- Rollenprioritäten sind kontextabhängig
- Tradeoffs werden nicht pauschal als negative Traits behandelt
- alle Datenänderungen laufen durch die automatische Validierung
- sichtbare Quellenangaben bleiben aus der App-Oberfläche heraus
