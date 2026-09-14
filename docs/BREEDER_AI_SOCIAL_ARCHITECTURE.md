# Breeder AI PWA – Social-, Server- und Freigabe-Zielbild

**Stand:** 14. September 2026  
**Status:** Zukunftsarchitektur; bewusst nicht Teil der ersten Implementierungsstufe

## 1. Zweck

Die Breeder AI PWA soll langfristig optional um einen getrennten Social-Bereich erweitert werden. Dieser Bereich darf den Kern aus Breeder, persönlichem Inventory, Planner und Mutation Engine weder technisch noch funktional voraussetzen oder verlangsamen.

Ziele der späteren Social-Schicht:

- sichtbare Nutzerprofile mit Nickname/Handle;
- Serverzugehörigkeiten;
- Gruppen-/Gildenzugehörigkeiten;
- freiwillige Freigabe konkreter Pals für gemeinsames Breeding;
- Showcase einzelner Pals;
- Likes und leichte Reaktionen;
- später projektbezogene Anfragen beziehungsweise Kommunikation;
- perspektivisch optionale Direktkommunikation, falls sie sich als sinnvoll erweist.

Nicht-Ziel der ersten Stufe ist ein allgemeiner Chat- oder Social-Media-Dienst.

## 2. Identitätsgrundsatz

Alle dauerhaften Beziehungen referenzieren ausschließlich eine interne, stabile `user_id`.

Die interne `user_id`:

- wird serverseitig erzeugt;
- ist unveränderlich;
- ist nicht vom Nutzer wählbar;
- muss nicht sichtbar sein;
- bleibt bei E-Mail-, Nickname-, Geräte- und Sessionwechsel unverändert.

Insbesondere dürfen folgende Werte niemals als Primär- oder Fremdschlüssel für dauerhafte Social-Daten dienen:

- E-Mail-Adresse;
- Nickname;
- sichtbarer Anzeigename;
- Geräte-ID;
- Session-ID;
- Cloudflare-Access-Session.

Beispiel:

```text
interne user_id: 8f72-...-....  <- stabil
        |
        +-- Login-E-Mail: alte@example.com -> neue@example.com
        +-- Nickname: Basti -> BastiDE
        +-- Geräte: Handy / Tablet / PC
        +-- Social-Objekte bleiben unverändert verknüpft
```

Eine Änderung von E-Mail oder Nickname darf niemals bestehende Reaktionen, Freigaben, Gruppenmitgliedschaften, Projekte oder spätere Nachrichten unzugänglich machen.

## 3. Profilmodell

Konzeptionell:

```text
user_profile
- user_id
- display_name
- handle / nickname
- locale
- optional avatar/profile presentation
- social_visibility
- created_at
- updated_at
```

`display_name` und `handle` sind veränderbar.

Für spätere Suche beziehungsweise Einladungen sollte der sichtbare Nickname nicht allein als eindeutige Identität verwendet werden. Bevorzugt wird eine Kombination aus:

- sichtbarem Nickname/Handle;
- kurzem, serverseitig erzeugtem Invite-/Friend-Code.

Damit können Nutzer Namen ändern, ohne dass Identität oder Verknüpfungen brechen. Der Invite-Code kann bei Missbrauch kontrolliert erneuert werden, ohne die interne `user_id` zu ändern.

## 4. Auth-Identität bleibt getrennt vom Social-Profil

Die Login-E-Mail ist eine Auth-Identität und kein Social-Identifier.

Konzeptionell:

```text
users
- user_id

auth_identities
- identity_id
- user_id
- provider
- normalized_email
- provider_subject
- active

user_profile
- user_id
- display_name
- handle
```

Self-Service-E-Mail-Wechsel darf nur aus einer bereits authentifizierten Sitzung erfolgen:

1. neue E-Mail angeben;
2. Code an die neue E-Mail senden;
3. Code erfolgreich bestätigen;
4. Auth-Zuordnung aktualisieren;
5. `user_id` unverändert lassen.

Der Social-Bereich darf die Login-E-Mail standardmäßig weder anzeigen noch zur Nutzersuche verwenden.

## 5. Server- und Gruppenebene

Ein Nutzer kann langfristig auf mehreren Palworld-Servern aktiv sein. Bestände und Freigaben können serverbezogen sein.

Konzeptionell:

```text
server_space
- server_id
- display_name
- optional description
- created_by_user_id

server_membership
- server_id
- user_id
- role/status

group_or_guild
- group_id
- server_id
- display_name

group_membership
- group_id
- user_id
- role/status
```

Serverzugehörigkeit und Gilden-/Gruppenzugehörigkeit sind getrennte Konzepte. Zwei Nutzer können auf demselben Server spielen, ohne derselben Gilde anzugehören.

Die erste Planner-Version bleibt hiervon unabhängig. Social-/Serverdaten werden erst später in Planner-Ergebnisse einbezogen.

## 6. Bestand und Serverbezug

Vor einer Social-Implementierung muss entschieden werden, ob ein Nutzer:

1. einen globalen persönlichen Bestand führt und Pals einzelnen Servern optional zuordnet; oder
2. vollständig getrennte Bestände pro Server führt.

Für gemeinsame Breeding-Funktionen darf ein freigegebenes Pal nur in dem Serverkontext angeboten werden, in dem es tatsächlich verfügbar ist.

Kein Social-Feature darf still annehmen, dass ein Pal serverübergreifend verfügbar ist.

## 7. Freigabe von Pals für gemeinsames Breeding

Der persönliche Bestand ist standardmäßig privat.

Später mögliche Freigabeebenen:

- Nutzer ist grundsätzlich bereit, Pals für Breeding bereitzustellen;
- konkrete Pal-Instanz ist freigegeben;
- konkrete Pal-Instanz ist nur auf Anfrage freigegeben;
- Freigabe ist auf Server/Gilde/Gruppe beschränkt;
- Freigabe kann jederzeit widerrufen werden.

Wichtig: `breeding_share = true` bedeutet ausschließlich, dass ein Pal als möglicher Zuchtpartner angeboten werden darf.

Es bedeutet niemals:

- Kondensationsmaterial;
- löschbar;
- übertragbar;
- automatisch verfügbar;
- vom Planner ohne Rückfrage als verbrauchbar.

Keeper- und Materialschutz bleiben vollständig erhalten.

## 8. Planner-Integration später

Eine spätere Gruppenfunktion kann dem Planner freigegebene externe Pals als optionale Ressource anbieten.

Beispiel:

```text
Eigener Bestand: kein passender Surfent
        |
        v
Gruppen-/Serverfreigaben prüfen
        |
        v
Spieler X hat passenden Surfent freigegeben
        |
        v
Planner-Hinweis:
"Spieler X hat auf diesem Server einen passenden Zuchtpartner."
        |
        v
[Anfragen]
```

Der Planner darf eine fremde Freigabe nie als garantiert verfügbar behandeln. Verfügbarkeit bleibt ein sozialer Zustand beziehungsweise eine Anfrage.

## 9. Showcase-Schicht

Ein privates Pal darf nur durch eine ausdrückliche Nutzeraktion öffentlich beziehungsweise gruppenweit sichtbar werden.

Bevorzugtes Modell:

```text
private pal_instance
        |
        | explizit "Zur Schau stellen"
        v
showcase_snapshot
```

Ein Showcase-Snapshot kann ausgewählte, freigegebene Felder enthalten, zum Beispiel:

- Pal-Art;
- Nickname des Pals optional;
- Passiven;
- IVs/Talente;
- Kondensationssterne;
- Erweckungsstatus;
- Lucky/Alpha/Variante;
- optional Bild-/Darstellungsmetadaten;
- Besitzerprofil via `owner_user_id`.

Der Snapshot darf keinen generischen Schreibzugriff auf den privaten Inventory-Datensatz eröffnen.

## 10. Reaktionen statt frühe Kommentarfunktion

Für eine erste Social-Stufe werden leichte positive Reaktionen bevorzugt:

- Like;
- Herz;
- Feuer;
- weitere kleine Reaktionen.

Konzeptionell:

```text
showcase_reaction
- showcase_id
- reacting_user_id
- reaction_type
- created_at
```

Die Referenz auf `reacting_user_id` stellt sicher, dass eine Nickname-Änderung keine Reaktion verliert.

Dislikes und freie Kommentare werden bewusst nicht für die erste Social-Ausbaustufe eingeplant, da sie Moderations-, Spam- und Missbrauchsanforderungen deutlich erhöhen.

## 11. Rankings und Highlights

Später mögliche leichte Community-Funktionen:

- Top-Showcases der Woche;
- meistgelikte Pals;
- aktuelle Highlights;
- gruppen-/serverbezogene Highlights.

Rankings dürfen nur aus ausdrücklich freigegebenen Showcase-Daten berechnet werden.

Sie dürfen keine versteckten privaten Bestandswerte auslesen.

## 12. Projektbezogene Kommunikation vor freiem Chat

Falls Kommunikation implementiert wird, soll zunächst kontextbezogene Kommunikation bevorzugt werden.

Beispiele:

- "Kann ich deinen Surfent für mein Elphidran-Aqua-Projekt nutzen?";
- "Spieler X hat deine Breeding-Anfrage angenommen.";
- "Dieser freigegebene Pal passt zu deinem Projekt.";
- Reaktion auf einen Showcase.

Eine spätere Nachrichtenstruktur referenziert ausschließlich interne User-IDs:

```text
message_thread
- thread_id
- participant_user_ids[]
- optional server_id
- optional project_id

message
- message_id
- thread_id
- sender_user_id
- body
- created_at
```

Nickname- oder E-Mail-Änderungen dürfen einen Thread niemals verändern oder unzugänglich machen.

Ein allgemeiner freier Chat ist erst später zu evaluieren. Das Kernprodukt darf davon nicht abhängen.

## 13. Technische Trennung vom Kernprodukt

Die Social-Schicht wird als separates Modul geplant.

```text
Core
├── Auth / stabile user_id
├── Inventory
├── Projects
├── Resolver
├── Planner
└── Breeder read-only

Optional Social
├── Profile
├── Server
├── Gruppen/Gilden
├── Breeding-Freigaben
├── Showcase
├── Reaktionen
└── spätere Kommunikation
```

Fällt die Social-Schicht aus oder wird deaktiviert, müssen persönlicher Bestand, Breeder und Planner weiter funktionieren.

## 14. Sicherheits- und Datenschutzgrenzen

Auch im privaten Friends-&-Family-Betrieb gelten technische Mindestgrenzen:

- private Bestände standardmäßig unsichtbar;
- explizite Freigabe für Social-Ansichten;
- keine E-Mail-Adressen als öffentliche Profilkennung;
- kein Zugriff auf fremde private Inventory-Daten;
- Server-/Gruppenberechtigungen serverseitig prüfen;
- Social-Endpunkte akzeptieren keine frei wählbare `owner_user_id` als Autorität;
- mutierende Social-Aktionen verwenden immer die authentifizierte interne `user_id`;
- Widerruf von Freigaben muss möglich sein;
- spätere Nachrichten und Reaktionen brauchen Lösch-/Blockierkonzepte, bevor sie über die kleine private Gruppe hinausgehen.

## 15. Noch offene spätere Entscheidungen

Vor einer Social-Implementierung sind mindestens folgende Punkte bewusst zu entscheiden:

1. globaler Bestand mit Serverzuordnung vs. komplett getrennter Bestand pro Server;
2. Einladungsmodell für Server/Gilden/Gruppen;
3. Sichtbarkeit von Profilen und Showcases;
4. eindeutiger Handle vs. frei änderbarer Displayname plus Invite-Code;
5. welche konkreten Pal-Felder ein Showcase enthalten darf;
6. welche Reaktionen unterstützt werden;
7. ob und wann freie Direktnachrichten sinnvoll werden;
8. Blockieren/Melden/Moderation bei größerem Nutzerkreis;
9. Aufbewahrung von Nachrichten;
10. wie Gruppenfreigaben im Planner gewichtet und bestätigt werden.

## 16. Einordnung in den Fahrplan

Diese Social-Schicht ist ausdrücklich Zukunftsmusik.

Vorherige Priorität bleibt:

1. stabile Auth-/Identity-Schicht;
2. privater Multi-User-Bestand;
3. Text-/Sprach-Mutation;
4. Entity Resolver;
5. Inventory-aware Planner;
6. Kondensations-/Sterneplanung;
7. Projektzustände und Verzweigungen;
8. erst danach optionale Social-/Server-/Gruppenfunktionen.

Die Datenmodelle des Kerns sollen Social später ermöglichen, aber V1 soll keine Social-Runtime, keine Gruppenkommunikation und keinen öffentlichen Showcase ausliefern.
