# Breeder AI PWA – IV/Talent Improvement Capabilities

**Stand:** 14. September 2026  
**Status:** vorbereitete Planner-Capability; bewusst standardmäßig deaktiviert und noch nicht produktiv integriert

## 1. Zweck

Dieses Dokument beschreibt eine spätere Erweiterung des Breeder AI Planners um validierte Ingame-Möglichkeiten, individuelle IVs/Talente nach dem eigentlichen Breeding gezielt zu verbessern.

Der Zweck ist nicht, Breeding zu ersetzen. Die Capability soll dem Planner lediglich erlauben, später zwischen zwei grundsätzlich unterschiedlichen Wegen zu unterscheiden:

```text
IVs/Talente vollständig über Breeding erreichen
vs.
Breeding bis zu einem guten Ausgangswert + später gezielte Verbesserung
```

Die Funktion wird zunächst nur architektonisch vorbereitet. Der Planner darf sie standardmäßig **nicht aktiv in Routen einpreisen**, bis aktuelle Spieldaten, Caps, Ressourcentypen, Kosten und Wirkungen gegen einen belastbaren Build validiert wurden.

## 2. Produktgrenze

Diese Capability gehört nur deshalb in Breeder AI, weil IV-/Talent-Ziele bereits Teil der Breeding-Planung sind.

Sie soll ausdrücklich **nicht** zu einem allgemeinen Character-/Stat-Optimizer ausgebaut werden.

Nicht Ziel dieser Capability sind:

- vollständige Level-Endstat-Berechnungen;
- Combat-/DPS-Simulation;
- Accessoire-, Buff- oder Zutraulichkeitssimulation;
- allgemeines Verbrauchsmanagement außerhalb des Breeding-/Planner-Kontexts.

## 3. Fachlicher Grundsatz

Der Planner darf IV-/Talent-Verbesserungen nur verwenden, wenn:

1. die zugrunde liegende Spielmechanik im aktuellen Build validiert ist;
2. die betroffenen Stats und Caps eindeutig bekannt sind;
3. Ressourcentyp und Verbrauchsverhalten bekannt sind;
4. der persönliche Bestand der Ressource bekannt oder bewusst ignoriert wird;
5. die Funktion im Planner ausdrücklich aktiviert wurde.

Unbekannt bleibt unbekannt.

Eine aus Erinnerung oder Nutzererfahrung genannte Regel darf als **Validation Candidate** festgehalten werden, aber nicht automatisch zur kanonischen Spielwahrheit werden.

## 4. Aktueller Validation Candidate

Aus der Produktdiskussion stammt die Annahme, dass bestimmte Früchte jeweils einen festen IV-/Talent-Zuwachs auf einen zugeordneten Stat geben können.

Als konkreter Kandidat wurde genannt:

```text
+10 auf den jeweils betroffenen IV-/Talentwert pro Frucht
```

Dieser Wert wird in diesem Dokument **nicht als kanonische Regel festgeschrieben**.

Vor Aktivierung muss ein Data-Core-/Build-Audit mindestens prüfen:

- welche Fruchttypen aktuell existieren;
- welchen Stat jede Frucht verändert;
- welcher exakte Zuwachs pro Nutzung gilt;
- welche Caps gelten;
- ob Überschusswerte möglich oder abgeschnitten werden;
- ob Nutzungsbeschränkungen bestehen;
- ob weitere Quellen dieselben IV-/Talentwerte beeinflussen.

## 5. Capability Registry

Konzeptionell:

```text
iv_improvement_capability
- capability_id
- stat_id
- resource_id
- delta_rule
- cap_rule
- restrictions{}
- resource_mode
  - consumable
  - reusable
  - other_validated_mode
- source_build
- provenance
- enabled_for_planner
```

`enabled_for_planner` bleibt bis zur fachlichen Freigabe standardmäßig `false`.

## 6. Persönlicher Ressourcenstate

Falls die Capability später aktiviert wird, kann der persönliche Ressourcenstate denselben Mandanten-/Play-Space-Grundsätzen folgen wie die Pal-Modification-Domain:

```text
iv_improvement_inventory
- user_id
- play_space_id
- resource_counts{}
- revision
- updated_at
```

Der Planner darf keine Ressource als vorhanden annehmen, wenn der Nutzerbestand unbekannt ist.

## 7. Planner-Statusmodell

Vorgesehene Zustände:

```text
DISABLED
VALIDATION_ONLY
AVAILABLE_AS_OPTION
ACTIVE_IN_SCORING
```

### `DISABLED`

Standardzustand. Die Capability beeinflusst keine Route.

### `VALIDATION_ONLY`

Daten dürfen technisch eingelesen und getestet werden, erscheinen aber nicht in Nutzerempfehlungen.

### `AVAILABLE_AS_OPTION`

Der Planner darf nach einer klassischen Breeding-Route optional erwähnen, dass ein IV-/Talent-Finish möglich sein könnte.

### `ACTIVE_IN_SCORING`

Erst nach ausdrücklicher späterer Freigabe. Dann darf die Ressource tatsächlich in die Routenbewertung eingehen.

Für den aktuellen Konzeptstand ist maximal `DISABLED` bzw. später `VALIDATION_ONLY` vorgesehen.

## 8. Verhältnis zu Breeding

Reine Breeding-Routen müssen immer ohne diese Capability berechenbar bleiben.

Die spätere Capability darf beispielsweise unterscheiden:

```text
Route A
- Ziel-IVs/Talente vollständig über Eltern / Zwischenprodukte

Route B
- gute Ausgangs-IVs/Talente über Breeding
- verbleibende Differenz später über validierte Verbesserung
```

Route B darf nie still als besser bewertet werden, solange Ressourcenverbrauch, Wert und Nutzerpräferenz nicht berücksichtigt werden.

## 9. Reasoning-Rolle

Das Reasoning-Modell darf später erklären:

- ob eine IV-/Talent-Differenz klein genug ist, dass eine Verbesserung als Finish sinnvoll erscheinen könnte;
- ob weitere Breeding-Schritte möglicherweise Ressourcen sparen;
- ob eine Ressource dem Nutzer zu wertvoll ist;
- ob der Nutzer ausdrücklich lieber weiterbreeden möchte.

Es darf nicht selbst entscheiden:

- dass die Fruchtmechanik aktuell gültig ist;
- welchen exakten Zuwachs eine Frucht gibt;
- welches Cap gilt;
- wie viele Früchte vorhanden sind;
- ob eine Ressource ohne Bestätigung verbraucht werden darf.

## 10. Schutz knapper Ressourcen

Falls IV-/Talent-Früchte später als verbrauchbare Ressourcen geführt werden, erben sie dieselben Schutzprinzipien wie andere knappe Consumables:

```text
allow
ask
avoid
never
```

Ein späterer Nutzerwunsch wie:

```text
"Für dieses Projekt keine IV-Früchte verwenden."
```

kann als projektbezogene Resource Policy gespeichert werden.

## 11. Verhältnis zu IV-/Talent-Warnungen

Diese Capability darf die bestehende Schutzlogik für starke Pals nicht schwächen.

Ein Pal mit hohen IVs/Talenten bleibt ein potenziell wertvolles Exemplar und kann weiterhin eine Warnung auslösen, bevor er als Material oder anderweitig verbrauchbar eingeplant wird.

Der genaue IV-/Talent-Warnthreshold bleibt separat zu evaluieren.

## 12. Tests vor Aktivierung

Mindestens erforderlich:

- Feature standardmäßig deaktiviert;
- keine Planner-Route verändert sich im Zustand `DISABLED`;
- unbekannte Fruchtmechanik wird nicht als verfügbar angenommen;
- Delta und Cap kommen ausschließlich aus validierten Daten;
- Ressourcenbestand ist auf `user_id` + `play_space_id` isoliert;
- Verbrauch mutiert nur den authentifizierten persönlichen Zustand;
- `never` blockiert Verwendung;
- `ask` erzwingt Bestätigung;
- reine Breeding-Route bleibt immer verfügbar;
- Reasoning-Modell kann die Capability nicht eigenmächtig aktivieren;
- keine unvalidierten Werte aus Prompt, Erinnerung oder Chat werden kanonisch übernommen.

## 13. Data-Core-Audit

Ein späterer Auftrag soll prüfen:

1. welche IV-/Talent-Fruchtdefinitionen im aktuellen Build extrahierbar sind;
2. welche Zielstats existieren;
3. wie Delta und Cap technisch repräsentiert sind;
4. welche Restriktionen gelten;
5. welche Item-/Resource-IDs kanonisch verwendet werden sollen;
6. ob Erwerbswege strukturiert extrahierbar sind;
7. welche Build-/Provenienzfelder für belastbare Revalidierung nötig sind.

## 14. Phasen

### I0 – vorbereitet / deaktiviert

Schema- und Interface-Hook dokumentieren, aber keine Planner-Nutzung.

### I1 – Data-Core-Audit

Aktuelle Mechanik und Ressourcen vollständig validieren.

### I2 – Validation-only Integration

Capability Registry und Tests, weiterhin ohne Nutzer-Routenbeeinflussung.

### I3 – optionale Planner-Erwähnung

Nur nach Review und ausdrücklicher Freigabe.

### I4 – Scoring-Integration

Nur falls sich die Funktion praktisch als wertvoll und ausreichend wartbar erweist.

## 15. Stopppunkte

Review ist erforderlich, wenn:

- Delta, Cap oder Statzuordnung unklar sind;
- die Daten nur durch Pal-/Item-spezifische Hardcodes reproduzierbar wären;
- Ressourcenverbrauch nicht sauber nachvollziehbar ist;
- die Capability den Planner unnötig in Richtung allgemeiner Stat-Simulation erweitert;
- die Funktion für Nutzer mehr Verwirrung als echten Breeding-Nutzen erzeugt.

## 16. Aktueller Konsens

- IV-/Talent-Früchte sind eine sinnvolle spätere Ergänzung des Breeding-Planners;
- sie werden jetzt architektonisch vorbereitet;
- die Planner-Funktion bleibt standardmäßig deaktiviert;
- OP-/Pal-Modification-Capabilities haben aktuell höhere Priorität;
- konkrete Fruchtmechaniken und Zahlen werden vor Aktivierung buildbezogen validiert;
- reine Breeding-Routen bleiben unabhängig davon vollständig nutzbar;
- eine spätere Aktivierung braucht Resource State, Schutzpolicy, Tests und ausdrückliches Review.
