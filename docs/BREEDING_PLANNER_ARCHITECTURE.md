# Breeding Planner – private bestandsoptimierte Architektur

**Stand:** 30. August 2026  
**Status:** Zielarchitektur; der aktuelle öffentliche Breeder bleibt zunächst unverändert read-only/stateless

## Ziel

Der heutige Breeder löst Arten- und Zuchtrouten aus allgemeiner Spielwahrheit. Eine spätere Planner-Schicht soll zusätzlich privaten Player State berücksichtigen:

- vorhandene konkrete Pal-Exemplare;
- Geschlechter;
- vollständige Passiven;
- IVs/Talente;
- Varianten/Formen;
- vorhandene Zwischenprodukte;
- Wiederverwendbarkeit wertvoller Träger.

Damit kann der Planner eine theoretisch kurze Route gegen eine praktisch bessere bestandsoptimierte Route abwägen.

## Warum nicht einfach GitHub bei jeder Anfrage durchsuchen

Ein Runtime-Tool sollte nicht bei jeder Planner-Abfrage mehrere Repositories durchsuchen müssen. Das wäre langsamer, stärker an GitHub-Verfügbarkeit gekoppelt und würde private Repository-Credentials in die Runtime ziehen.

Die kanonischen Quellen bleiben trotzdem getrennt:

- allgemeine Game Truth: `MC-Micro/pal-tool`;
- privater Player State: `MC-Micro/pal-vault`.

## Bevorzugte Runtime-Struktur

```text
MC-Micro/pal-tool
  Data Core + Breeding Engine
           │
           ▼
    private Planner Runtime
           ▲
           │
privater Player-State-Snapshot
           ▲
           │ kontrollierter Sync
MC-Micro/pal-vault
```

Der private Snapshot ist ein Runtime-Artefakt und keine neue kanonische Wahrheit. Seine Provenienz muss auf einen konkreten Vault-Commit beziehungsweise eine Player-State-Version verweisen.

## MCP-/Plugin-Oberflächen

### Öffentlicher Breeder

Die bestehenden fünf öffentlichen Tools bleiben ohne privaten Zustand:

- `breeding_status`
- `breeding_pair`
- `breeding_parents`
- `breeding_children`
- `breeding_route`

Der anonyme öffentliche MCP darf niemals private Player-State-Daten lesen oder zurückgeben.

### Private Planner-Erweiterung

Später sinnvoll sind authentifizierte Planner-Tools, zum Beispiel konzeptionell:

- Bestandsstatus beziehungsweise Snapshot-Status;
- bestandsoptimierte Route zu einem Ziel-Pal;
- Passiv-Transfer-Plan;
- IV-/Talent-Transfer-Plan;
- kombinierter Arten-/Passiv-/IV-Plan.

Die endgültigen Toolnamen und Schemas werden erst nach dem Player-State-Datenmodell und der Planner-Logik festgelegt.

## Sicherheitsprinzip

Der öffentliche MCP und private Planner müssen logisch und authentifizierungsseitig getrennt bleiben.

Mögliche spätere Implementierungen:

1. gleiche Codebasis, aber getrennte authentifizierte/private Route beziehungsweise Deploymentgrenze;
2. eigener privater Planner-Service, der die öffentliche Breeding Engine als Bibliothek wiederverwendet.

Ein direkter anonymer Zugriff auf `pal-vault` ist ausgeschlossen.

## Planner-Auswertung

Eine praktische Route muss mindestens getrennt bewerten:

1. Artenroute und Specials;
2. erforderliche Geschlechter;
3. vorhandene Eltern und Zwischenprodukte;
4. gewünschte/unerwünschte Passiven;
5. IVs/Talente;
6. Varianten/Formen;
7. Beschaffbarkeit fehlender Arten;
8. spätere Wiederverwendbarkeit der Linie.

Die Engine darf keine unbestätigten Wahrscheinlichkeiten oder exakten Eierzahlen erfinden.

## Synchronisation des Player State

Bevorzugt wird später ein kontrollierter Sync aus dem Vault in einen privaten Runtime-Snapshot, nicht ein Live-GitHub-Read pro Toolaufruf.

Ein Sync muss mindestens prüfen:

- Quelle/Commit;
- Schema-/Snapshot-Version;
- Validierung der IDs gegen den Data Core;
- keine Secrets oder nicht erlaubten Vault-Bereiche;
- atomarer Austausch des letzten gültigen Snapshots;
- Rollback auf den letzten gültigen Stand.

## Aktueller Stopppunkt

Der aktuelle Core-Refresh baut zuerst die zuverlässige allgemeine Game Truth und revalidiert den Breeder. Der private Planner wird erst implementiert, wenn:

- der Data Core stabil ist;
- der private Player State kontrolliert migriert wurde;
- Authentifizierung und Runtime-Snapshot geprüft sind.
