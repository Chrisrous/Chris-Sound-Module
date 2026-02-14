// SoundPad UI and drag-and-drop logic for targeting playlist sounds to specific players.
export let enableLogging = false; // Standardmäßig deaktiviert

// Funktion zur Aktualisierung der Logging-Einstellungen
Hooks.once("init", () => {
  game.settings.register("chris-sound-module", "enableLogging", {
    name: game.i18n.localize("CHRIS_SOUND_MODULE.Setting.EnableLoggingName"),
    hint: game.i18n.localize("CHRIS_SOUND_MODULE.Setting.EnableLoggingHint"),
    scope: "client", // Nur für den aktuellen Client
    config: true,
    default: false, // Standardmäßig deaktiviert
    type: Boolean,
    onChange: value => {
      enableLogging = value; // Aktualisiert die Variable
    }
  });

  // Initialer Wert aus den Einstellungen laden
  enableLogging = game.settings.get("chris-sound-module", "enableLogging");
});

// Hilfsfunktion für konsolenbasiertes Logging
function logMessage(message, ...optionalParams) {
  if (enableLogging) {
    console.log(message, ...optionalParams);
  }
}

class SoundPad extends FormApplication {
  constructor(options = {}) {
    super(options);
    this.sounds = []; // Zentrale Datenstruktur für Sounds
    this.selectedSoundId = null; // ID des aktuell ausgewählten Sounds
    this.selectedSoundName = null; // Name des aktuell ausgewählten Sounds
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "soundpad",
      title: "SoundPad",
      template: "modules/chris-sound-module/templates/soundpad.html",
      width: 500,
      height: 400,
      resizable: true,
      dragDrop: [{ dragSelector: ".soundpad-drop-area", dropSelector: null }], // Drag-and-Drop aktivieren
    });
  }

  activateListeners(html) {
    // Aktiviert die Listener der Basisklasse und fügt spezifische Listener für das SoundPad hinzu.
    super.activateListeners(html);

    // Spieler-Auswahl Dropdown
    const playerSelect = html.find(".player-select");

    // Debugging: Verfügbare Spieler anzeigen
    logMessage("Verfügbare Spieler:", game.users.contents.map((u) => u.name));

    // Sound auswählen
    html.find(".sound-button").click((event) => {
      // Dieser Block verarbeitet die Auswahl eines Sounds durch den Nutzer.
      // Es wird die ID und der Name des ausgewählten Sounds gespeichert und die Anzeige aktualisiert.
      const button = event.currentTarget;
      this.selectedSoundId = button.dataset.soundId;
      this.selectedSoundName = button.dataset.soundName;

      logMessage(`Sound ${this.selectedSoundName} ausgewählt (ID: ${this.selectedSoundId})`);

      // Entferne "active"-Klasse von allen Sound-Buttons
      html.find(".sound-button").removeClass("active");
      // Füge "active"-Klasse nur beim aktuellen Button hinzu
      $(button).addClass("active");

      // Aktualisiere die Anzeige für den aktuell ausgewählten Sound
      html.find(".selected-sound-display").text(this.selectedSoundName);
    });

    // Play-Button
    html.find(".play-button").click(() => {
      // Klick auf den Play-Button spielt den aktuell ausgewählten Sound für den ausgewählten Spieler ab.
      if (!this.selectedSoundId || !this.sounds[this.selectedSoundId]) {
        console.error(game.i18n.localize("CHRIS_SOUND_MODULE.Messages.SelectSoundFirst"));
        return;
      }

      const soundData = this.sounds[this.selectedSoundId];
      logMessage("Sound wird abgespielt:", soundData);

      const playerName = playerSelect.val();
      if (!playerName) {
        console.warn(game.i18n.localize("CHRIS_SOUND_MODULE.Messages.SelectPlayerFirst"));
        return;
      }

      playSoundForPlayer(playerName, soundData.playlist, soundData.name);
    });

    // Stop-Button
    html.find(".stop-button").click(() => {
      // Dieser Block sendet den Stop-Befehl an den aktuell ausgewählten Spieler, um die Wiedergabe des Sounds zu beenden.
      const playerName = playerSelect.val();

      if (!playerName) {
        console.warn(game.i18n.localize("CHRIS_SOUND_MODULE.Messages.SelectPlayerFirst"));
        return;
      }

      logMessage(`Sende Stop-Befehl an Spieler '${playerName}'`);
      controlSoundForPlayer(playerName, 'stopSound');
    });

    // Lautstärkeregler
    html.find("#volume-slider").on("input", (event) => {
      // Dieser Block verarbeitet den Lautstärkeregler und passt die Lautstärke für den ausgewählten Spieler entsprechend an.
      const volume = parseFloat(event.target.value);
      const playerName = playerSelect.val();

      if (!playerName) {
        console.warn(game.i18n.localize("CHRIS_SOUND_MODULE.Messages.SelectPlayerFirst"));
        return;
      }

      logMessage(`Ändere Lautstärke auf ${volume} für Spieler '${playerName}'`);
      changeVolumeForPlayer(playerName, volume);
    });

    // Button: Alle Sounds entfernen
    html.find(".clear-sounds").click(() => {
      logMessage("Alle Sounds werden entfernt.");
      this.sounds = []; // Leere die zentrale Datenstruktur
      this.render(true); // Aktualisiere die Ansicht
    });

    // Debugging: Überprüfe Buttons nach Initialisierung
    html.find(".sound-button").each((index, button) => {
      logMessage("Initialisierter Button:", {
        soundId: button.dataset.soundId,
        soundName: button.dataset.soundName,
      });
    });
  }

  /**
   * Bereitet die Daten für die Anzeige in der Benutzeroberfläche des SoundPads vor.
   * Liefert eine Liste von Sounds und die verfügbaren Benutzer im Spiel.
   */
  getData() {
    const users = game.users.contents.map((user) => ({ name: user.name }));
    return { sounds: this.sounds, users };
  }

  /**
   * Diese Methode verarbeitet das Drag-and-Drop-Event für Sounds.
   * Es wird überprüft, ob die Daten gültig sind und ein Sound aus einer Playlist hinzugefügt werden kann.
   * Die hinzugefügten Sounds werden in der zentralen Datenstruktur gespeichert und die Ansicht wird aktualisiert.
   */
  async _onDrop(event) {
    event.preventDefault();

    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
      logMessage("Daten aus Drag-and-Drop-Event:", data); // Debugging-Ausgabe
    } catch (err) {
      console.error(game.i18n.localize("CHRIS_SOUND_MODULE.Messages.DropDataError"), err);
      return;
    }

    if (data.type === "PlaylistSound") {
      const uuidParts = data.uuid.split(".");
      const playlistId = uuidParts[1];
      const soundId = uuidParts[3];

      const playlist = game.playlists.get(playlistId);
      if (!playlist) {
        console.error(game.i18n.localize("CHRIS_SOUND_MODULE.Messages.PlaylistNotFound"), playlistId);
        return;
      }

      const sound = playlist.sounds.get(soundId);
      if (!sound) {
        console.error(game.i18n.localize("CHRIS_SOUND_MODULE.Messages.SoundNotFoundInPlaylist"), soundId);
        return;
      }

      this.sounds.push({
        name: sound.name,
        src: sound.path,
        playlist: playlist.name, // Playlist-Name hinzufügen
      });

      logMessage("Aktualisierte Sounds-Liste nach Hinzufügen:", this.sounds); // Debugging hinzugefügt
      this.sounds.forEach((sound, index) => {
        logMessage(`Sound #${index}: Name=${sound.name}, Pfad=${sound.src}, Playlist=${sound.playlist}`);
      });

      logMessage(`Sound "${sound.name}" hinzugefügt:`, sound);
      this.render(true);
    } else {
      console.warn(game.i18n.localize("CHRIS_SOUND_MODULE.Messages.InvalidDropType"), data.type);
    }
  }
}

Hooks.once("ready", () => {
  if (!game.user.isGM) {
    console.warn(game.i18n.localize("CHRIS_SOUND_MODULE.Messages.GmOnly"));
    return;
  }

  game.settings.registerMenu("chris-sound-module", "soundpad", {
    name: game.i18n.localize("CHRIS_SOUND_MODULE.Setting.OpenSoundPad"),
    label: game.i18n.localize("CHRIS_SOUND_MODULE.Setting.SoundPadLabel"),
    icon: "fas fa-music",
    type: SoundPad,
    restricted: true, // Nur GMs können das SoundPad öffnen
  });

  window.soundPad = new SoundPad();
});

window.SoundPad = SoundPad;
