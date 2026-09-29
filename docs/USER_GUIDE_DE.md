# Chris SoundPad: Anleitung

## Installation

Für die Installation im Foundry-Startbildschirm unter **Zusatzmodule > Modul installieren**
diese Manifest-Adresse einfügen. Bei vorhandener Installation mit dieser Adresse genügt
die Update-Funktion. Foundry v14 ist erforderlich.

```text
https://raw.githubusercontent.com/Chrisrous/Chris-Sound-Module/main/module.json
```

**Manuelle Alternative oder Umstieg von einer Testversion ohne Update-Adresse:**

Sichere Welt und Modulordner. Beende Foundry und ersetze nur den Ordner
`Data/modules/chris-sound-module` durch den gleichnamigen Ordner aus der ZIP. Starte Foundry
neu und lade alle verbundenen Browser neu. Prüfe in der Modulverwaltung die Version 2.0.0.
Gespeicherte Pads und Gruppen aus RC2 bis RC6 bleiben erhalten. Die Weltdateien nicht löschen.

Als Spielleiter öffnest du das Fenster über den Kopfhörer links, den Playlist-Button rechts
oder die Moduleinstellungen. Alle Zugänge verwenden dasselbe Fenster.

## Ein Lautstärkeregler

Wähle einen Sound. Der gemeinsame Regler übernimmt dessen gespeicherten Standard. Stelle die
gewünschte Lautstärke ein. Sie gilt für den nächsten Start und das nächste Vorhören.
**Das Verschieben allein verändert weder laufende Sounds noch gespeicherte Einstellungen.**

**Auf Wiedergabe anwenden** sendet den eingestellten Wert an die daneben angezeigten Empfänger.
Betroffen ist deren gerade laufender oder noch ladender Modul-Sound, unabhängig von der
Soundauswahl. Das funktioniert auch ohne ausgewählten Sound.

**Als Sound-Standard speichern** speichert denselben Wert für den ausgewählten Eintrag.
Laufende Wiedergabe bleibt unverändert. Im Bearbeitungsbereich gibt es keinen zweiten Regler.
Sein Speichern/Abbrechen betrifft nur Name, Kategorie, Wiederholung und Übergänge.

Beispiel: Regen läuft bei Anna. Du wählst Tür und stellst 30% ein. Regen bleibt unverändert.
Mit Abspielen startet Tür bei 30%. Mit Anwenden wird Annas aktueller Modul-Sound leiser, also
gegebenenfalls noch Regen. Mit Als Sound-Standard speichern erhält nur Tür den Standard 30%.

Beim Wechsel zu einem anderen Sound wird dessen Standard geladen. Erneute Auswahl desselben
Sounds und gewöhnliches Neuzeichnen behalten deinen vorbereiteten Wert. Persönliche
Spielerlautstärke und Stummschaltung bleiben als Schutz in den Moduleinstellungen erhalten.

## Empfänger und Bedienung

Öffne Auswahl ändern und setze die Häkchen bei den gewünschten Benutzern. Auswahl aufheben
entfernt alle Häkchen, stoppt aber keine Wiedergabe. Online-Spieler auswählen wählt keine GMs.
Gespeicherte Gruppen werden erst mit dem ausdrücklichen Speichern oder Aktualisieren geändert.

Ziehe Playlist-Sounds in ein benanntes Pad. Ein Klick wählt einen Sound nur aus. Suche,
Kategorien und Favoriten helfen beim Finden. Unter Aktionen kannst du Einträge bearbeiten
oder entfernen. Pad verwalten bietet Anlegen, Umbenennen, Sortieren, Leeren und Löschen.
Die Quelldateien und Original-Playlists werden nicht geändert.

Empfängerauswahl stoppen beendet die Wiedergabe bei den angezeigten Empfängern. Vorhören
stoppen betrifft nur deine Vorschau. Alle Modul-Sounds stoppen ist der getrennte Not-Stopp.
Normale Foundry-Playlists bleiben immer unberührt.

## Rückmeldungen und Fehlersuche

Ausgewählter Sound, Vorschau und letzte Wiedergaberückmeldung sind getrennt. Eine Rückmeldung
gehört zur aktuellen Spielleiter-Sitzung, nicht zu einem globalen Live-Mixer. Keine Rückmeldung
bedeutet nicht sicher, dass nichts läuft. Mehrere Tabs können denselben Sound mehrfach abspielen.

Prüfe bei Stille die Auswahl, persönliche Stummschaltung, Foundry-Kanallautstärke und den
Dateipfad. Klicke einmal in das Spielerfenster, um Browser-Audio freizugeben. Lade alle Clients
neu. Melde Fehler mit genauen Versionen und reproduzierbaren Schritten. Entferne Zugangsdaten
und signierte Dateilinks aus Konsolenprotokollen.
