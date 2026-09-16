# Palworld Passives PWA (legacy, frozen)

Diese App ist der vollständig konservierte historische Passives-PWA-Stand des Repositorys. Sie diente als installierbare, offlinefähige deutsch/englische Übersicht für Breeding- und Buildplanung.

## Status

- **Legacy / frozen / paused:** keine laufende fachliche Weiterentwicklung.
- Datenstand: historischer 102er Produkt-/Editorial-Overlay, Tool `v1.0.0`, Baseline `Palworld v1.0.0` vom 11.07.2026.
- Der aktuelle kanonische Passive-Referenzraum unter `data/palworld-core/` umfasst getrennt davon 115 Einträge und wird durch diese App nicht ersetzt oder aktualisiert.
- Die App ist aus dem Repository-Root nach `apps/passives-pwa/` verschoben. Die physische Verschiebung allein ändert die GitHub-Pages-Konfiguration nicht.

## Validierung

Vom Repository-Root:

```text
node apps/passives-pwa/scripts/validate.mjs
```

Der kleine App-Validator prüft ausschließlich den unveränderten 102er Overlay, JavaScript-Syntax, erforderliche PWA-Dateien, historische bekannte Assertions, Manifest-/Cache-Verweise und den eingefrorenen Cache-Namespace. Die repositoryweite kanonische Approval-Prüfung bleibt separat in `node scripts/validate-data.mjs`.

## Reaktivierung

Eine Reaktivierung benötigt einen eigenen Review von Produktstatus, Hostingpfad, Manifest- und Service-Worker-Scope, Datenmodell, kanonischem Consumer-Artefakt, CI sowie Rollback. Der historische 102er Overlay darf dabei nicht still als aktuelle Game Truth behandelt werden.

Besondere Warnung: Der Service Worker verwendet weiterhin den historischen Cache-Namespace `palworld-passives-pwa-v1.0.0-meta1`. Bei Wiederverwendung derselben Origin können installierte Clients und bestehende Caches noch auf Root-Pfade beziehungsweise alte Assets zeigen. Vor erneutem Hosting auf derselben Origin sind Cache-Migration, Scope, Start-URL, installierte Clients und kontrollierte Ausphasung ausdrücklich zu testen; der Namespace darf nicht beiläufig wiederverwendet werden.
