# Breeder AI – Passive Resolver Discovery Handoff

**Stand:** 15. September 2026
**Status:** offizieller typisierter Candidate-Proof auf `ac8fe06` ausgewertet; evidenzbasierte Namens-/Rank-/Gate-Korrektur lokal, erneuter offizieller Lauf noch offen

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

## Lokaler Implementierungsstand nach der Discovery

Auf `breeder/passive-resolver-discovery` ist die in den Schritten 1 bis 3 beschriebene Candidate-/Review-Pipeline lokal implementiert:

- `passives` umfasst Main und Main_Common mit dem Profil `passive-technical-v1`;
- EN/DE `DT_SkillNameText_Common` sind eigene katalogisierte Lokalisierungsquellen;
- der neue Befehl `passive-candidate` bewahrt die feldbegrenzte technische Evidenz und erzeugt einen Domain-spezifischen Candidate-Hash;
- `review-passive-candidate.mjs` coalesced gleiche `sourceRow`-Werte, ignoriert Ordinals bei der Inhaltsidentität, blockiert echte Konflikte und weist fehlende beziehungsweise mehrdeutige Namen aus;
- der historische Overlay wird ausschließlich bei übereinstimmenden exakten EN-/DE-Treffern gemappt;
- der offizielle Workflow ist auf byteidentischen Doppelbuild, Artefakt-Upload und nachgelagerten Konflikt-Gate vorbereitet.

Dieser Absatz beschreibt den damaligen Review-Stop vor dem ersten typisierten Candidate-Lauf. Der danach ausdrücklich freigegebene Push und Run `34970361170` liefern die nachfolgende neuere Evidenz.

## Offizieller typisierter Candidate-Run und Korrekturevidenz

Der offizielle Workflow lief nach dem freigegebenen Push exakt auf:

```text
branch: breeder/passive-resolver-discovery
commit: ac8fe06a0483b31fdc24122e82230b91f860a85d
workflow run: 34970361170
result: success
Dedicated Server build: 25247047
artifact: pal-data-core-candidate-25247047
artifact id: 10397252031
artifact digest: sha256:ddfd31c24c4cbe764f573848fe0c5dee64d7ea32f5515f7d213ddacbf558aba0
```

Candidate-Doppelbuild, Passive-Review, Breeding-Regression und Artefakt-Upload waren technisch erfolgreich. Die unabhängige Artefaktreview widerlegte jedoch zwei Modellierungsannahmen des ersten Reviewcodes; das ist neue Game-Truth-Evidenz und kein Toolfehler.

### Belegte Namensreferenzregel

Das Artefakt enthält 3810 Source Rows aus Main/Main_Common, konfliktfrei coalesced zu 1905 technischen Entities. Jede `sourceRow` kommt genau einmal pro Quelle vor; Case-Kollisionen existieren nicht. Bei allen 1905 Entities ist `OverrideNameTextId = None`.

Die 115 `EPalPassiveCategory::SortDisplayable`-Entities besitzen trotzdem vollständig belegte Namen: Für 115/115 existiert `PASSIVE_<sourceRow>` sowohl in EN als auch DE. Beispiele:

- `Rare` → `PASSIVE_Rare` → `Lucky` / `Außergewöhnlich`;
- `MoveSpeed_up_3` → `PASSIVE_MoveSpeed_up_3` → `Swift` / `Blitzschnell`;
- `CraftSpeed_up3` → `PASSIVE_CraftSpeed_up3` → `Remarkable Craftsmanship` / `Goldenes Händchen`;
- `Legend` → `PASSIVE_Legend` → `Legend` / `Legendär`.

Die korrigierte Regel lautet: Ein realer expliziter `OverrideNameTextId` hat Vorrang. Nur wenn er leer oder `None` ist, wird `PASSIVE_<sourceRow>` geprüft. Der abgeleitete Key gilt ausschließlich dann als beobachtete Referenz, wenn er in offizieller Lokalisierung tatsächlich vorhanden ist; andernfalls bleibt die Entity unresolved.

### Belegte Resolver-Domänengrenze

Der breite Technical Candidate bewahrt weiterhin alle 1905 Entities:

- 115 `SortDisplayable`;
- 1790 `SortNotDisplayable`.

Der user-facing Resolver-/Reference-Space wird dagegen auf die 115 displaybaren, offiziell benannten Entities begrenzt. `SortDisplayable` belegt nur user-visible Resolver-Relevanz. Es ist keine Aussage über Vererbbarkeit, Züchtbarkeit, Stackability oder Effect-Semantik.

Der historische Overlay mappt nach der belegten Namensregel 102/102 exakt bilingual, ohne fehlende oder mehrdeutige Paarzuordnung. 13 weitere aktuelle displaybare Entities liegen außerhalb des Overlays; der Overlay bleibt daher ein redaktioneller historischer Ausschnitt und keine Whitelist der aktuellen Game Truth.

### Belegte Namensambiguität

Unter den 115 displaybaren Entities sind die englischen Namen eindeutig. Im Deutschen besteht eine echte Ambiguität:

```text
ElementBoost_Normal_2_PAL → Celestial Emperor → Erleuchteter
WorldTree_Sanity           → Hermit Sage       → Erleuchteter
```

Diese Ambiguität bleibt erhalten. Der bilinguale Overlay-Crosswalk ist dennoch eindeutig, weil EN und DE gemeinsam genau eine übereinstimmende `sourceRow` liefern können.

### Rank-Typkorrektur und Gate

Das offizielle Inventory belegt `Rank` als `IntProperty`. Der erste Candidate las ihn fälschlich als String und erzeugte für alle Entities einen leeren Wert. Candidate-Schema 2 liest und validiert `Rank` numerisch, ohne fachliche Rank-Semantik zu erfinden.

Das korrigierte Review-Gate verlangt:

- keine technischen Main/Common-Konflikte;
- keine für displaybare Namensreferenzen relevanten Lokalisierungskonflikte;
- belegte Referenz sowie EN und DE für jede displaybare Entity;
- vollständigen historischen Overlay-Crosswalk ohne fehlende oder widersprüchliche Paarzuordnung.

Zusätzliche aktuelle displaybare Entities und echte Einzelsprachen-Ambiguitäten blockieren nicht, bleiben aber sichtbar. Der Resolver-Reference-Space-Hash umfasst nur `sourceRow`, belegte Namensreferenz, EN und DE der displaybaren Entities. Der breite `technicalCandidateSha256` bleibt unverändert das Audit-/Artefakt-Fingerprint-Konzept.

Die Korrektur wird lokal getestet, aber in diesem Block weder gepusht noch remote ausgeführt. Adapter-Key, kanonische Veröffentlichung und `PassiveResolver` bleiben bis zur erneuten offiziellen Current-Build-Bestätigung bewusst offen.
