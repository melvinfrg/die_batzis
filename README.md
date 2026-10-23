# 🐻🐰 Die Batzi's

Eure gemeinsame Alltags-Zentrale: Dashboard, ToDos, Einkaufsliste, Kalender, Tage-Tracker, Reisen und ein Tagebuch mit einer Nachricht pro Tag. Alles synchronisiert sich live zwischen euren Handys und Laptops.

**Technik:** reines HTML/CSS/JavaScript (kein Build-Schritt) · Supabase für Login + Datenbank + Live-Updates · Hosting über GitHub Pages.

---

## ✅ Was schon erledigt ist

- Supabase-Projekt **„die batzi's“** ist eingerichtet: alle Tabellen, Zugriffsschutz (Row Level Security) und Live-Updates.
- `js/config.js` enthält schon die URL und den öffentlichen Schlüssel eures Projekts.
- `melvinfrohberg@outlook.de` ist als Mitglied freigeschaltet.

## 1 · Deine Freundin freischalten

Nur E-Mail-Adressen in der Tabelle `members` kommen an eure Daten – fremde Leute können sich zwar registrieren, sehen aber nichts.

Supabase → **SQL Editor** → ausführen:

```sql
insert into public.members (email) values ('ihre@email.de');
```

## 2 · Auf GitHub hochladen

1. Auf github.com ein neues Repository anlegen, z. B. `die-batzis` (gern **Private**, aber dann braucht GitHub Pages einen Pro-Account – sonst **Public**; eure Daten liegen ja geschützt in Supabase, nicht im Code).
2. Alle Dateien aus diesem Ordner hochladen („Add file → Upload files“, Ordnerstruktur beibehalten) **oder** per Terminal:
   ```bash
   git init && git add . && git commit -m "Die Batzi's 💞"
   git branch -M main
   git remote add origin https://github.com/DEIN-NAME/die-batzis.git
   git push -u origin main
   ```
3. Im Repo: **Settings → Pages → Source: „Deploy from a branch“ → Branch `main` / `/ (root)` → Save**.
4. Nach ~1 Minute läuft die Seite unter `https://DEIN-NAME.github.io/die-batzis/`.

## 3 · Supabase die Adresse verraten (wichtig für die Bestätigungs-Mail)

Supabase → **Authentication → URL Configuration**:

- **Site URL:** `https://DEIN-NAME.github.io/die-batzis/`
- **Redirect URLs:** dieselbe Adresse hinzufügen

Optional: Unter **Authentication → Sign In / Providers → Email** kannst du „Confirm email“ ausschalten, dann entfällt die Bestätigungs-Mail.

## 4 · Loslegen

1. Seite öffnen → **Registrieren** → E-Mail bestätigen → anmelden.
2. Name, Tier und Farbe wählen.
3. Deine Freundin macht dasselbe – ab dann seht ihr alles gemeinsam und live.

📱 **Tipp:** Auf dem Handy im Browser „Zum Home-Bildschirm hinzufügen“ – dann startet die Seite wie eine App.

---

## Funktionen

| Bereich | Was geht |
|---|---|
| 🏡 **Dashboard** | Begrüßung, „Zusammen seit …“, heutige Tagebuch-Nachricht, fällige ToDos (direkt abhaken), Einkauf (direkt hinzufügen/abhaken), nächste Termine, Countdown zur nächsten Reise, gepinnte Tracker |
| ✅ **ToDos** | Fälligkeit, Priorität, Wer (ich / du / beide), Kategorien, Unteraufgaben, Notizen, Wiederholung (täglich bis jährlich – beim Abhaken entsteht automatisch die nächste), Filter & Suche, Gruppierung nach Überfällig/Heute/Morgen/… · Schnell-Eingabe: `Müll rausbringen @morgen #Haushalt !` |
| 🛒 **Einkauf** | Automatische Sortierung nach Supermarkt-Bereich, Menge & Notiz, mehrere Sachen mit Komma auf einmal, „Schnell nochmal“-Vorschläge, Abhaken → „Im Wagen“, Laden pro Artikel (wird gemerkt und vorgeschlagen), Ansicht nach Laden, Angebote-Knopf (marktguru) |
| 📅 **Kalender** | Monatsansicht, ganztägig/mit Uhrzeit, mehrtägig, Wiederholung (wöchentlich, monatlich, jährlich – z. B. Geburtstage mit Alter), Farben, Ort; Reisen und fällige ToDos erscheinen automatisch |
| ⏳ **Tracker** | Tage seit …, Jahre/Monate/Tage, nächster Meilenstein mit Fortschritt, Jahrestags-Hinweis, „Neu starten“ mit Rekord-Historie, aufs Dashboard pinnen |
| ✈️ **Reisen** | Bevorstehend / Vergangen / Wunschliste, Statistik (Reisen, Tage, Länder), je Reise: Notizen, Tagesplan, Links (Flug, Unterkunft, Tickets …), Packliste mit Standardliste, Kosten mit „Wer schuldet wem“, Budget, Sterne-Bewertung, Titelbild |
| 📸 **Fotos** | Eigene Lieblingsfotos hochladen (werden verkleinert, privat gespeichert), Bildunterschrift, auswählen, welche aufs Dashboard kommen |
| 🍳 **Rezepte** | 34 Alltagsrezepte + eigene, täglich wechselnde Vorschläge (einstellbar: vegetarisch, max. Zeit, Anzahl), „Was haben wir da?“ mit Vorrat, fehlende Zutaten per Knopf auf die Einkaufsliste, „Heute kochen“, Favoriten |
| 🗂️ **Orga** | Versicherungen, Strom & Energie, Verträge, Abos, Wohnen, Mobilität … mit Betrag, Zahlweise, wer zahlt, Vertragsnr., Kündigungsfrist · Reiter **Kosten**: pro Monat/Jahr, nach Bereich, wer zahlt was, Fristen-Erinnerung aufs Dashboard |
| 💌 **Tagebuch** | Eine Nachricht pro Person und Tag mit Stimmung · die Nachricht des anderen wird erst aufgedeckt, wenn man selbst geschrieben hat 😉 · „Wie geht’s dir heute?“ mit Stimmung + Notiz – wahlweise privat (wird dann in der Datenbank wirklich vor dem anderen verborgen) · Stimmungsverlauf · Streak, „Heute vor einem Jahr“, Archiv |

## Ordnerstruktur

```
index.html            Einstieg
css/style.css         Design (hell + dunkel automatisch)
js/config.js          Supabase-URL + öffentlicher Schlüssel
js/db.js              Datenzugriff (Supabase oder Demo)
js/app.js             Login, Navigation, Live-Updates
js/views/*.js         Die einzelnen Seiten
supabase/schema.sql   Datenbank-Schema (Teil 1)
supabase/migration-2.sql  Erweiterung: Fotos, Gefühle, Rezepte, Orga
assets/               Logo & App-Icons
```

## Demo-Modus

Wenn in `js/config.js` URL und Schlüssel leer sind, läuft die Seite mit Beispieldaten nur im Browser – praktisch zum Ausprobieren oder Weiterentwickeln. Lokal starten: `python3 -m http.server` im Ordner, dann `http://localhost:8000` öffnen.
