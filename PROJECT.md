# HYBRID — Training reimagined

## Was ist das?

**HYBRID** ist der Prototyp einer Trainings-App, die vier Sportarten gleichwertig kombiniert: **Krafttraining, Laufen, Radfahren und Schwimmen**. Statt sich auf nur eine Sportart zu spezialisieren (wie die meisten Apps), erstellt HYBRID einen klugen Wochenplan, der alle Disziplinen sinnvoll miteinander verbindet — ohne dass du dich am Tag nach intensivem Beintraining gleich auf ein Intervall-Lauftraining quälst.

Das ganze Projekt ist eine **einzige HTML-Datei** (`hybrid-app-prototyp.html`). Du kannst sie einfach im Browser öffnen — keine Installation, keine Server, keine Datenbank im Hintergrund. Alles läuft lokal auf deinem Gerät.

> **Status:** Version 0.1 — ein Konzept-Test der Idee. Noch kein fertiges Produkt, aber alle Kernfunktionen sind benutzbar.

---

## Die wichtigsten Features

### 1. Onboarding — der Einstieg
Beim ersten Öffnen führt dich die App durch sieben Fragen:
- **Welche Sportarten** machst du? (Kraft, Laufen, Rad, Schwimmen — Mehrfachauswahl möglich)
- **Wo trainierst du Kraft?** (Fitnessstudio, zuhause, draussen)
- **Welches Level?** (Einsteiger, Fortgeschritten, Erfahren)
- **Was ist dein Ziel?** (Body Recomposition, Wettkampf, Kraft & Muskeln, allgemeine Fitness)
- **Wie oft pro Woche?** (Schieberegler pro Sportart, max. 7 Einheiten/Woche empfohlen)
- **Wie heisst du?**

Aus diesen Antworten wird automatisch ein persönlicher Wochenplan erstellt.

### 2. Intelligenter Plan-Generator
Die App verteilt deine Workouts klug über die Woche. Sie folgt dabei Trainingsregeln aus der Sportwissenschaft:
- **Kein Intervall-Lauf direkt nach Beintraining** (24h Erholung)
- **Long Run** bekommt einen vorgelagerten Tag ohne Beine
- **Pause-Tage** werden bewusst eingeplant
- Bei Krafttraining wird je nach Häufigkeit ein passender Split gewählt: Ganzkörper (1–2×), Ganzkörper + Oberkörper + Beine (3×), Push/Pull/Legs/Oberkörper (4–5×)
- Übungen werden je nach Trainingsort gewählt (Hanteln im Gym vs. Liegestütze zuhause)

### 3. Täglicher Check-in
Jeden Tag kannst du in vier Kategorien angeben, wie es dir geht (jeweils 1–5):
- **Energie-Level** (😩 müde bis 🔥 voll da)
- **Schlafqualität**
- **Muskelkater**
- **Gesamtgefühl**

Bei schlechten Werten meldet die App: *„Plan angepasst — heute lockerer"*. Bei Top-Werten: *„Voll durchziehen"*.

### 4. Workout-Tracking
Jedes Workout lässt sich öffnen und live mitprotokollieren:
- **Krafttraining:** Pro Übung Sets eintragen (Gewicht in kg, Wiederholungen, Häkchen wenn erledigt)
- **Cardio (Laufen/Rad/Schwimmen):** Distanz, Zeit, durchschnittliche Herzfrequenz, gefühlte Anstrengung (RPE 1–10)
- Knopf „Workout abschliessen" markiert es als erledigt

### 5. Wochen-Übersicht & Dashboard
Auf der Startseite siehst du:
- Persönliche Begrüssung mit Tageszeit
- Drei Stat-Boxen: erledigte Workouts diese Woche, geplant total, **🔥 Streak** (Tage in Folge mit Training)
- Heutige Workouts als Karten
- Wochenkalender mit Punkt pro Tag (gelb = geplant, grün = erledigt)
- „Als nächstes" — Vorschau auf die kommenden Workouts

### 6. Statistiken
Eine eigene Stats-Seite zeigt:
- **Total Workouts** mit Balkendiagramm nach Sportart
- **🏋️ Total gehoben** (Summe aus Gewicht × Wiederholungen aller Sätze)
- **🏃 Distanz Cardio** (km gesamt)
- **⏱ Trainingszeit** (Stunden + Minuten)
- **🔥 Aktuelle Streak**

### 7. Profil & Reset
Übersicht über deine Einstellungen (Sportarten, Ziel, Level, Ort, wöchentliches Volumen) plus zwei Knöpfe:
- **Plan neu generieren** (behält Workout-Logs)
- **Alles zurücksetzen** (löscht alle Daten)

### 8. Speicherung
Alle Daten (Profil, Plan, Check-ins, Workout-Logs) werden lokal über `window.storage` gespeichert. Nach dem Schliessen und Wiederöffnen ist alles noch da.

---

## Wie ist der Code aufgebaut?

Die Datei ist in drei klassische Web-Bestandteile geteilt:

```
hybrid-app-prototyp.html  (~2.775 Zeilen)
├── <style>     → CSS: das gesamte Design (Farben, Schrift, Layout)
├── <body>      → HTML: das Grundgerüst (eigentlich nur 3 leere Container)
└── <script>    → JavaScript: die ganze Logik
```

### Das Design (CSS, Zeilen ~9–1252)
- **Dunkles Theme** mit knalligem Neon-Gelbgrün als Akzentfarbe (`#d4ff00`)
- Drei Schriftarten: **Bebas Neue** (grosse Überschriften), **Inter** (Texte), **JetBrains Mono** (Zahlen, Labels)
- Mobile-first: max. 480px breit, alles fühlt sich an wie eine native Smartphone-App
- Sanfte Animationen (Fade-ins, Slide-ups, pulsierender Logo-Punkt)

### Das Grundgerüst (HTML, Zeilen ~1255–1280)
Erstaunlich wenig HTML — nur drei Bereiche:
1. **Header** (Logo + Settings-Knopf)
2. **Content-Bereich** (wird von JavaScript dynamisch befüllt)
3. **Bottom-Navigation** (Plan / Stats / Profil)

Alle Bildschirme werden zur Laufzeit von JavaScript ins `<div id="content">` gerendert.

### Die Logik (JavaScript, Zeilen ~1282–2771)
Der Code ist in **klar markierte Abschnitte** gegliedert (jeder mit einem Kommentar-Block):

| Abschnitt | Was es tut |
|-----------|------------|
| **STATE & PERSISTENCE** | Verwaltet das `state`-Objekt (alle App-Daten) und speichert/lädt es |
| **PLAN GENERATOR** | Erstellt aus deinen Antworten den Wochenplan |
| **ONBOARDING** | Die 9 Onboarding-Bildschirme |
| **HOME / DASHBOARD** | Die Startseite mit heutigen Workouts und Wochenübersicht |
| **CHECK-IN MODAL** | Das tägliche Stimmungs-Eingabefenster |
| **WORKOUT TRACKING MODAL** | Das Eingabefenster zum Mitprotokollieren der Workouts |
| **DAY DETAIL** | Detail-Ansicht eines einzelnen Tages |
| **STATS PAGE** | Die Statistik-Seite |
| **PROFILE PAGE** | Die Profil-Seite |
| **NAV / TABS** | Wechsel zwischen den Tabs |
| **MODAL HELPERS** | Hilfs-Funktionen für Pop-up-Fenster und Toast-Meldungen |
| **INIT** | Startet die App: lädt gespeicherte Daten oder zeigt Onboarding |

---

## Die wichtigsten Funktionen im Detail

### `generatePlan(data)` — das Herzstück
Bekommt die Onboarding-Daten und gibt einen Plan für 7 Tage zurück. Verteilt zuerst Kraft-Tage, dann Lauf-Workouts (mit Beachtung der „kein Intervall nach Legs"-Regel), dann Rad und Schwimmen. Wählt automatisch passende Übungen aus der `EXERCISE_LIBRARY` (eine Sammlung mit ~10 Workout-Vorlagen für Gym vs. Zuhause).

### `renderHome()` — die Startseite
Berechnet Tagesstatistiken, prüft ob heute schon Check-in gemacht wurde, baut die Übersicht der heutigen und kommenden Workouts zusammen.

### `openWorkout(workoutId, dayKey)` — Workout starten
Öffnet ein Pop-up mit Tracking-Feldern. Bei Krafttraining: Tabelle mit Sätzen (KG / Wiederholungen / Häkchen). Bei Cardio: Felder für Distanz, Zeit, Herzfrequenz, RPE.

### `saveCheckin()` — Check-in speichern
Liest die vier Stimmungswerte aus, speichert sie und gibt eine motivierende Rückmeldung — passend zur Tagesform.

### `getStreak()` — Streak berechnen
Zählt rückwärts ab heute, wie viele Tage in Folge mindestens ein Workout abgeschlossen wurde.

### `saveState()` / `loadState()` — Persistenz
Schreiben und lesen den App-Zustand (Profil, Plan, Logs, Check-ins) in den lokalen Speicher des Browsers, sodass nichts verloren geht.

### `showModal()` / `closeModal()` / `showToast()` — UI-Helfer
Erzeugen die schwebenden Pop-up-Fenster und kleinen Benachrichtigungs-Banner oben am Bildschirm.

---

## Eingebaute „Datenbanken" (Konstanten im Code)

- **`SPORT_INFO`** — Icons, Labels und Farben für jede Sportart
- **`EXERCISE_LIBRARY`** — Übungs-Sammlung mit Vorlagen wie *push_gym*, *pull_gym*, *legs_home*, *full_home* usw. Pro Übung: Name, Sätze, Wiederholungen, benötigtes Equipment

---

## Was steckt nicht drin (noch)?

- Keine echten Settings (der Knopf zeigt nur einen Hinweis)
- Keine Verbindung zu Wearables (Garmin, Apple Watch, Strava)
- Kein Backend — alles bleibt auf deinem Gerät
- Keine echte Coaching-KI — die Anpassung ans Tagesgefühl ist noch sehr einfach
- Keine Übungs-Videos oder Erklärungen

Das ist bewusst so: HYBRID v0.1 ist ein **Konzept-Beweis**, der zeigen soll, wie sich die App anfühlt und ob das Konzept einer hybriden Trainings-App in der Praxis funktioniert.
