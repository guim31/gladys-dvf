# DVF: Immobilienverkäufe

Bringt die **rund um dein Zuhause in Frankreich veröffentlichten Immobilienverkäufe** und die
**Medianpreise pro m²** von Wohnungen und Häusern nach Gladys, aus **Demandes de valeurs
foncières (DVF)**: den von der DGFiP (französische Steuerverwaltung) erfassten Verkäufen, von
Etalab geolokalisiert und als offene Daten veröffentlicht. Ohne Konto, ohne Schlüssel.

> **Das ist eine Information, keine Bewertung deiner Immobilie.** DVF veröffentlicht nur Preis,
> Datum, Art und Fläche einer verkauften Immobilie: nicht Zustand, Stockwerk oder Arbeiten. Ein
> Median über wenige Verkäufe schwankt stark. Die Integration ist nicht mit der DGFiP oder Etalab
> verbunden.
>
> Getestet mit den echten DVF-Dateien (Toulouse, Vigoulet-Auzil, Paris) und dem Fake-Gladys des
> SDK, noch nicht mit einer echten Gladys-Instanz: Rückmeldungen willkommen.

## Was du bekommst

- **Ein Gerät „Immobilienverkäufe“** pro verfolgter Zone, mit:
  - dem **Medianpreis pro m²** von **Wohnungen** und **Häusern** über die **letzten 12
    veröffentlichten Monate** und über die **12 Monate davor** (zum Vergleich mit dem Vorjahr);
  - der **Anzahl der Verkäufe** von Wohnimmobilien in beiden Zeiträumen;
  - dem **Datum des letzten veröffentlichten Verkaufs** und dem **Monat, bis zu dem die Daten
    reichen**.
- Einen **Szenen-Auslöser** „Neue Immobilienverkäufe veröffentlicht“, mit ihrer Anzahl, bei jeder
  neuen DVF-Veröffentlichung.
- Eine **Szenen-Aktion** „Zusammenfassung der Immobilienverkäufe“: ein Satz, bereit für eine
  Nachricht („Im Umkreis von 1 km um Maison: 225 Verkäufe in den 12 veröffentlichten Monaten bis
  Dezember 2025; Medianpreise: Wohnungen 4.866 €/m².“).
- Ein **Widget** für das Dashboard: die Medianpreise und die **10 letzten Verkäufe** der Zone
  (Art, Zimmer, Fläche, Preis, Datum, Entfernung vom Haus).
- Einen Knopf **„Jetzt prüfen“** in der Konfiguration, der diese Zusammenfassung für jede Zone
  liefert.

## Voraussetzungen

- Gladys Assistant **5.3.0** oder neuer.
- Internetzugang von Gladys aus: die Integration liest `files.data.gouv.fr` (die DVF-Dateien) und
  `geo.api.gouv.fr` (die Gemeinde eines Standorts).
- Ein Haus **in Frankreich**, außerhalb von **Elsass-Moselle** (Bas-Rhin, Haut-Rhin, Moselle) und
  **Mayotte**, wo es kein DVF gibt (eigenes Grundbuch).
- Für die Standardoption der **Standort deines Hauses** in Gladys (Einstellungen, Häuser). Die
  Integration fragt bei der Installation danach (Berechtigung „Standort“). Er dient nur dazu, die
  Gemeinden der Zone und die Entfernung der Verkäufe zu bestimmen; er wird weder gespeichert noch
  in die Protokolle geschrieben.

## Konfiguration

### Einstellungen

| Einstellung                | Was sie bewirkt                                                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standort                   | **Mein Haus in Gladys** (Standard), **Alle meine Häuser in Gladys** oder **Eine Gemeinde (INSEE-Code)**.                                           |
| Haus                       | Leer (Standard): jedes Haus in Gladys mit Standort, je ein Gerät. Ein Haus: nur dieses.                                                            |
| Zone um das Haus           | **300 m**, **500 m**, **1 km** (Standard), **2 km** oder **Seine ganze Gemeinde**. Ein Kreis kann mehrere Gemeinden abdecken: alle werden gelesen. |
| INSEE-Code der Gemeinde    | 5 Zeichen, **nicht die Postleitzahl**: `31555` für Toulouse, `2A004` für Ajaccio.                                                                  |
| Sprache der Funktionsnamen | Namen der Funktionen eines neuen Geräts, Sprache der Daten, der Zusammenfassung und der Variablen des Auslösers. Standard: Französisch.            |

Speichere, öffne dann den Tab **Entdecken** der Integration und füge das Gerät hinzu. Der erste
Download dauert einige Sekunden (kleine Gemeinde) bis eine Minute (Paris).

### Paris, Lyon, Marseille

DVF wird dort **pro Arrondissement** veröffentlicht. Rund um ein Haus liest die Integration die
Arrondissements, die die Zone berührt; mit „Seine ganze Gemeinde“ das Arrondissement des Hauses;
mit dem INSEE-Code der Stadt (`75056`, `69123`, `13055`) alle Arrondissements.

### Prüfen: „Jetzt prüfen“

Der Knopf liest Häuser, Zone und Daten erneut und zeigt dann eine Zusammenfassung pro Zone. Eine
klare Fehlermeldung erscheint oben in der Konfiguration, wenn etwas fehlt (kein Standort,
unbekannter INSEE-Code, Gemeinde ohne DVF, Dienst nicht erreichbar).

## Gerät

| Funktion                                  | Wert                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| Wohnungen, Median €/m² (12 Monate)        | Medianpreis pro m² der Verkäufe einer einzelnen Wohnung, letzte 12 veröffentlichte Monate. |
| Häuser, Median €/m² (12 Monate)           | Dasselbe für Häuser.                                                                       |
| Wohnungen / Häuser, Median €/m² (Vorjahr) | Dieselben Mediane über die 12 Monate davor.                                                |
| Verkäufe (12 Monate), Verkäufe (Vorjahr)  | Anzahl der Verkäufe von Wohnimmobilien (Wohnungen und Häuser) pro Zeitraum.                |
| Letzter veröffentlichter Verkauf          | Datum des jüngsten Verkaufs der Zone.                                                      |
| Daten veröffentlicht bis                  | Der Monat, bis zu dem die aktuelle DVF-Veröffentlichung reicht („Dezember 2025“).          |

Ein Median wird erst ab **3 Verkäufen** veröffentlicht: darunter bleibt die Funktion ohne Wert.
Die „letzten 12 Monate“ sind die **der Veröffentlichung**, nicht des heutigen Tages: DVF kommt
Monate nach den Verkäufen.

## Widget

Füge das Widget **Immobilienverkäufe** zum Dashboard hinzu. Einstellungen: die **Zone** (leer: die
erste) und zwei Schalter, um **die Medianpreise** oder **die letzten Verkäufe** auszublenden. Es
zeigt drei Kacheln (Wohnungen, Häuser, Anzahl der Verkäufe), dann bis zu 10 Verkäufe und die
Quelle mit dem Namen, den du dem Gerät in Gladys gegeben hast. Keine Adresse wird angezeigt.

## Szenen-Auslöser und -Aktion

- **Neue Immobilienverkäufe veröffentlicht**: löst aus, wenn eine neue DVF-Veröffentlichung
  Verkäufe bringt, die jünger sind als der letzte bekannte der Zone. Filter: die Zone (leer: alle).
  Variablen: Anzahl neuer Verkäufe, Zone, Veröffentlichungsmonat, Verkäufe in 12 Monaten,
  Mediane für Wohnungen und Häuser, zusammenfassender Satz. Die erste gesehene Veröffentlichung
  (oder eine geänderte Zone) löst nichts aus: sie ist die Referenz.
- **Zusammenfassung der Immobilienverkäufe**: liefert den zusammenfassenden Satz und die Zahlen
  einer Zone für die nächste Aktion (zum Beispiel eine Nachricht senden).

## Szenenbeispiele

- „Wenn rund um Maison neue Verkäufe veröffentlicht werden, schick mir die Zusammenfassung per
  Telegram.“
- „Am Ersten des Monats um 9 Uhr schick mir die Zusammenfassung der Verkäufe meiner Gemeinde.“

## Daten, Lizenz und Kontingente

- **Quelle**: „Demandes de valeurs foncières géolocalisées“, DGFiP und Etalab, unter der Licence
  Ouverte 2.0, auf `files.data.gouv.fr/geo-dvf`. Fünf Jahre Verkäufe, **zweimal im Jahr**
  aktualisiert (etwa April und Oktober), Monate nach den Verkäufen.
- **Berücksichtigte Verkäufe**: Verkäufe, Verkäufe vom Bauträger und Versteigerungen mit
  mindestens einer Wohnung oder einem Haus. Tausch, Bauland und Enteignungen bleiben außen vor.
  Der Preis pro m² stammt nur aus Verkäufen einer einzelnen Wohnimmobilie (Nebengebäude
  eingeschlossen), ohne Ausreißer (unter 200 oder über 50.000 €/m²).
- **Downloads**: eine kleine Indexseite **einmal am Tag**, um zu sehen, ob eine neue
  Veröffentlichung erschienen ist; die Dateien (eine pro Gemeinde und Jahr) **nur** dann,
  gespeichert in `/data`. Für diese Dienste ist kein Kontingent veröffentlicht; die Integration
  bleibt weit darunter.
- **Nutzungsbedingungen von DVF**: jede **Re-Identifizierung** von Personen (Verkäufer, Käufer)
  ist verboten. Die Dateien enthalten keine Namen; die Integration speichert und zeigt keine
  Adresse, nur Art, Fläche, Preis, Datum und eine Entfernung.

## Fehlerbehebung

| Symptom                                      | Was tun                                                                                                    |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| „Kein Haus in Gladys hat einen Standort“     | Setze das Haus auf der Karte unter Einstellungen → Häuser oder wähle „Eine Gemeinde (INSEE-Code)“.         |
| „keine DVF-Daten im Elsass, in Lothringen …“ | In diesen Départements gibt es kein DVF: die Integration kann dort nichts anzeigen.                        |
| „files.data.gouv.fr ist nicht erreichbar“    | Prüfe den Internetzugang von Gladys. Die Integration versucht es jede Stunde erneut und behält ihre Daten. |
| Ein Median bleibt leer                       | Weniger als 3 Verkäufe dieser Art in der Zone: vergrößere sie (2 km oder die ganze Gemeinde).              |
| Die Verkäufe sind Monate alt                 | Normal: DVF wird zweimal im Jahr veröffentlicht, mit mehreren Monaten Verzug.                              |

Ausführliche Protokolle: Umgebungsvariable `LOG_LEVEL=debug`.

## Grenzen

- Die Daten liegen **4 bis 10 Monate** hinter den Verkäufen, und ein Verkauf kann erst in einer
  späteren Veröffentlichung erscheinen.
- Eine Zone von 2 km liest die Gemeinden in der Mitte und an 12 Punkten des Kreises: eine
  Gemeinde, die nur zwischen zwei Punkten berührt wird, kann fehlen.
- Verkäufe ohne Koordinaten in DVF (selten) zählen nur mit „Seine ganze Gemeinde“ oder einem
  INSEE-Code.
- Die Funktionsnamen werden beim Anlegen des Geräts festgelegt.
