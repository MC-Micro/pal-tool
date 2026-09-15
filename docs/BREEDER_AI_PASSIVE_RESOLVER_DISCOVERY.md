# Breeder AI – Passive Resolver Discovery Handoff

**Stand:** 15. September 2026  
**Status:** offizieller Dedicated-Server-Discovery-Proof abgeschlossen; Implementierung des kanonischen Passive-Crosswalks noch offen

## Zweck

Dieses Dokument hält ausschließlich den nach dem Merge von PR #10 verifizierten technischen Discovery-Stand für das noch offene Phase-0-Gate `Passive resolver / candidate crosswalk` fest.

Es ist **keine** Freigabe von Phase 1, keiner produktiven Breeder-AI-Runtime und keiner vollständigen Passiven-Wirkungsdomäne.

## Ausgangspunkt

Verifizierter `main`-Stand vor diesem Discovery-Branch:

```text
main SHA: b3e4daabeb4a6bbc3f132393d0898b0b3e45cea3
merged PR: #10 feat: add Breeder AI Phase 0 technical spikes
```

Discovery-Branch:

```text
breeder/passive-resolver-discovery
initial discovery commit: f99a2ddf373f641faf42c5907d5a414782b14c8e
```

Der Branch ergänzt im versionierten Data-Core-Katalog nur tokenbasierte Discovery für Passive-Skill-Tabellen sowie Skill-Name- und Skill-Description-Lokalisierung. Es wurden keine Passiven fachlich interpretiert und keine kanonischen Daten veröffentlicht.

## Offizieller Current-Build-Probe

Der GitHub-native `Probe Pal Data Core`-Workflow lief erfolgreich gegen den anonym verfügbaren offiziellen Palworld Dedicated Server.

```text
workflow run: 34960294929
result: success
Steam Dedicated Server build: 25247047
artifact: pal-data-core-candidate-25247047
artifact id: 10393031508
artifact digest: sha256:0f17fce6fee67a2f7f6c2822cf63ba0d17dea13a25124a843b5e0ab5c9c291ff
```

Auch der schnelle `Pal Data Core CI`-Gate auf demselben Branch war grün.

Wichtig: Das Review-Artefakt enthält nur normalisierte Candidate-Dateien. Raw PAKs, Mappings und vollständige Original-DataTables wurden weder committed noch als Artefakt veröffentlicht.

## Verifizierte Passive-Quellen

### Katalogisierte Main-Tabelle

```text
Pal/Content/Pal/DataTable/PassiveSkill/DT_PassiveSkill_Main
row count: 1905
present: true
parsed: true
```

Der Current-Build-Field-Inventory bestätigt auf allen 1905 Zeilen unter anderem:

- `Rank`;
- `LotteryWeight`;
- `Category`;
- `OverrideNameTextId`;
- `OverrideDescMsgID`;
- `OverrideSummaryTextId`;
- `EffectType1` bis `EffectType4`;
- `EffectValue1` bis `EffectValue4`;
- `TargetType1` bis `TargetType4`;
- `InvokeActiveOtomo`;
- `InvokeAlways`;
- `InvokeInBaseCamp`;
- `InvokeInOtomo`;
- `InvokeReserve`;
- `InvokeRiding`;
- `InvokeWorker`;
- `AddPal`;
- `AddRarePal`;
- `AddMutationPal`;
- `AddWorldTreePal`;
- weitere Add-/Trigger-/Stacking-Felder.

Diese Felder sind zunächst **Rohdaten**. Ihre fachliche Bedeutung darf nicht allein aus Feldnamen abgeleitet oder als produktive Regel freigegeben werden.

### Zusätzlich offiziell entdeckte Passive-Tabelle

Die Current-Build-Discovery bestätigt außerdem:

```text
Pal/Content/Pal/DataTable/PassiveSkill/DT_PassiveSkill_Main_Common
```

Sie ist noch nicht als zweite Quelle des katalogisierten `passives`-Eintrags aufgenommen. Vor einer kanonischen Domain-Veröffentlichung muss Main/Common wie bei anderen Data-Core-Domänen gemeinsam betrachtet und auf widersprüchliche gleiche Row-Identitäten geprüft werden.

### Offiziell entdeckte Lokalisierung

Für Passiven-/Skillnamen existieren im aktuellen Dedicated Server unter anderem:

```text
Pal/Content/L10N/en/Pal/DataTable/Text/DT_SkillNameText_Common
Pal/Content/L10N/de/Pal/DataTable/Text/DT_SkillNameText_Common
```

Für Beschreibungen existieren entsprechend:

```text
Pal/Content/L10N/en/Pal/DataTable/Text/DT_SkillDescText_Common
Pal/Content/L10N/de/Pal/DataTable/Text/DT_SkillDescText_Common
```

Weitere Sprachen und die nicht lokalisierten Basis-Tabellen wurden ebenfalls entdeckt, sind für das Phase-0-DE/EN-Resolver-Gate aber nicht erforderlich.

## Breeding-Regressionscheck auf dem neuen Build

Der bestehende read-only Breeding-Candidate-Review lief im selben Current-Build-Probe erfolgreich weiter.

```text
Steam build: 25247047
technical snapshot schema: 2
technical snapshot sha256: 4eed73f5b0d9195e01ff46cab48f6d20feafb17ae0f21138fc5219435198fc7a
technical Pal rows after source coalescing: 753
reviewed canonical Pals: 299
technical breeding rows: 258
reviewed canonical specials: 136
candidate cross-species specials: 136
source conflicts: 0
Pal mismatches: 0
missing canonical specials: 0
new candidate specials: 0
review result: ok = true
```

Damit ist durch diesen Discovery-Schritt keine Breeding-Regression sichtbar geworden. Das bedeutet nicht automatisch, dass jeder andere Data-Core-Bereich zwischen Spielversionen unverändert ist.

## Aktuelle Identitätsentscheidung

Noch **nicht** freigegeben ist eine dauerhafte `passive_id`.

Die aktuelle offizielle Evidenz macht die DataTable-Row-Identität (`SourceRow` / RowName) zum stärksten Kandidaten für einen namespaceten Phase-0-Adapter-Key. Diese Kandidatur muss jedoch erst durch eine typisierte Extraktion und einen reviewbaren Crosswalk-Proof bestätigt werden.

Bis dahin gilt weiterhin:

- `data-passives.js.nr` ist keine Domain-ID;
- Arrayposition, `sourceOrdinal`, Rang oder lokalisierter Name sind keine dauerhafte Passive-ID;
- lokalisierte Namen sind Aliasse/Anzeige- und Resolverdaten, nicht Identität;
- kein Fuzzy-Treffer darf eine Identitätsmigration erzeugen;
- synthetische Testfixtures sind keine produktive Identität;
- unbekannte oder mehrdeutige Zuordnungen bleiben explizit offen.

## Nächster Implementierungsauftrag

Der nächste technische Block soll **nur** den Passive-Identity-/Crosswalk-Proof schließen, nicht die vollständige Passiven-Wirkungsdomäne P6 implementieren.

### 1. Data-Core-Quellen exakt katalogisieren

Nach der jetzigen offiziellen Discovery dürfen die bestätigten Quellen aufgenommen werden:

- `DT_PassiveSkill_Main`;
- `DT_PassiveSkill_Main_Common`;
- `DT_SkillNameText_Common` für `en`;
- `DT_SkillNameText_Common` für `de`.

Skill-Beschreibungen können für einen späteren Wirkungsblock vorbereitet bleiben, sind aber kein Pflichtbestandteil dieses Resolver-Proofs.

### 2. Typisierten technischen Passive-Candidate erzeugen

Der Technical Core soll mindestens bewahren:

- `sourceRow`;
- `sourceOrdinal` nur als technische Provenienz, niemals als Domain-ID;
- `overrideNameTextId`;
- rohe Klassifikations-/Eligibility-Felder nur soweit für spätere Review nötig, ohne vorzeitige Semantik;
- EN-/DE-Lokalisierungszeilen;
- Package-Pfad und Current-Build-Provenienz.

Main/Common-Zeilen mit gleicher Row-Identität müssen deterministisch coalesced werden. Inhaltliche Konflikte müssen fail-closed als Review-Blocker erscheinen.

### 3. Passive-Crosswalk-Review bauen

Ein read-only Review-Schritt soll beweisen:

- welche technischen Row-Identitäten eindeutig zu EN-/DE-Namen auflösbar sind;
- welche Namensreferenzregel tatsächlich aus den aktuellen offiziellen Feldern folgt;
- ob Namen fehlen oder mehrfach/mehrdeutig zugeordnet sind;
- wie die bisherige 102-Einträge-Passives-PWA als **redaktioneller Overlay** gegen kanonische Row-Identitäten gemappt werden kann;
- Overlay-Zuordnungen nur bei eindeutiger Evidenz akzeptieren;
- keine automatische Fuzzy-Zuordnung als kanonische Wahrheit.

### 4. Erst nach erfolgreichem Review den Phase-0-Adapter-Key festlegen

Wenn der Proof die Row-Identität bestätigt, darf ein namespaceter Adapter-Key eingeführt werden, zum Beispiel semantisch:

```text
namespace = palworld.passive.source_row
value     = <kanonische technische Row-Identität>
```

Der konkrete Namespace-String ist Teil des Reviews und darf nicht allein aus diesem Handoff als bereits endgültig angenommen werden.

Die Referenz muss an einen nachvollziehbaren Passive-Dataset-/Build-Fingerprint gebunden sein. Dataset-Wechsel oder unbekannte Keys müssen wie beim Species-Resolver fail-closed beziehungsweise als Migration erforderlich behandelt werden.

### 5. Breeder-AI PassiveResolver-Proof

Erst nach freigegebenem Crosswalk:

- exakter interner Key;
- exakter deutscher Name;
- exakter englischer Name;
- echte Mehrdeutigkeit;
- sichere Fuzzy-Kandidaten ohne Autoritätswirkung;
- `not_found`;
- Dataset-Mismatch;
- unbekannter persistierter Key;
- keine stille Fuzzy-/Positionsmigration.

Der Provider-Mention-Typ `kind: "passive"` bleibt bis dahin nur Syntax und kein Resolver-Beweis.

## Nicht Teil dieses Blocks

Ausdrücklich **nicht** automatisch umsetzen:

- vollständige Interpretation von `EffectType*` / `EffectValue*`;
- Stackability-Regeln;
- Partnerfähigkeitssemantik;
- Reit-/Spieler-/Basis-Wirkungsmodell;
- Mutation-/World-Tree-Sondermechaniken;
- finale Passives-PWA-Migration;
- Phase 1;
- Remote D1;
- Cloudflare Access/OTP;
- reale Reasoning-/Speech-/Research-Provider;
- Deployment.

## Dokumentationshygiene nach PR #10

`docs/BREEDER_AI_IMPLEMENTATION_ROADMAP.md` enthält noch Post-Review-Branch-/Draft-PR-Formulierungen, obwohl PR #10 inzwischen gemergt ist. Beim nächsten technischen Branch soll dieser Status minimal auf den tatsächlich gemergten `main`-SHA aktualisiert werden.

Außerdem ist präzise zu formulieren: PR #10 hat **kein Breeder-AI-/Cloudflare-Deployment** ausgelöst. Der Merge auf `main` hat jedoch das bereits bestehende automatische GitHub-Pages-Build/Deployment des öffentlichen Repositories ausgelöst. Diese beiden Deployment-Begriffe dürfen künftig nicht vermischt werden.
