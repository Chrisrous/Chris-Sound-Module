// Socket message handling for remote sound playback, stopping, and volume control.

// Importiert die Logging-Konfiguration aus dem SoundPad-Modul
import { enableLogging } from './SoundPad.js'; // Pfad anpassen

// Hilfsfunktion für konsolenbasiertes Logging
function logMessage(message, ...optionalParams) {
  if (enableLogging) {
    console.log(message, ...optionalParams);
  }
}

// Initialisierung des Socket-Listeners, wenn das Spiel bereit ist
Hooks.once('ready', () => {
  logMessage("Chris Sound Module: Initializing socket listener...");

  // Listener für eingehende Nachrichten vom Modul-Socket
  game.socket.on('module.chris-sound-module', (data) => {
    // Überprüft, ob die Aktion 'playSound' und der Benutzer korrekt ist
    if (data.action === 'playSound' && data.userId === game.user.id) {
      try {
        // Sicherstellen, dass die Lautstärke innerhalb eines gültigen Bereichs liegt (0-1)
        const volume = isNaN(data.data.volume) || data.data.volume < 0 || data.data.volume > 1 ? 0.8 : data.data.volume;
        const sound = new Audio(data.data.src); // Erstellt eine neue Audio-Instanz
        sound.volume = volume; // Setzt die Lautstärke
        sound.loop = data.data.loop; // Setzt den Loop-Modus

        // Startet die Wiedergabe des Sounds
        sound.play().then(() => {
          window.currentAudio = sound; // Speichert die Audio-Referenz global
          logMessage(`Sound ${data.data.src} wird abgespielt.`);
        }).catch(error => {
          console.error(`Audio playback failed: ${error}`); // Fehler beim Abspielen
        });
      } catch (error) {
        console.error(`Error playing audio: ${error}`); // Allgemeiner Fehler
      }
    } else if (data.action === 'stopSound' && data.userId === game.user.id) {
      // Stoppt die Wiedergabe, wenn 'stopSound' gesendet wird
      if (window.currentAudio) {
        window.currentAudio.pause();
        window.currentAudio.currentTime = 0; // Setzt den Wiedergabeposition zurück
        window.currentAudio = null; // Löscht die Audio-Referenz
        logMessage(`Sound gestoppt.`);
      }
    } else if (data.action === 'changeVolume' && data.userId === game.user.id) {
      // Ändert die Lautstärke des aktuellen Sounds
      if (window.currentAudio) {
        window.currentAudio.volume = data.volume;
        logMessage(`Lautstärke wurde auf ${Math.round(data.volume * 100)}% geändert.`);
      }
    }
  });

  logMessage("Chris Sound Module: Socket-Listener initialisiert.");
});

// Funktion zum Abspielen eines Sounds für einen Spieler
export function playSoundForPlayer(playerName, playlistName, songName) {
  // Findet den Spieler anhand des Namens
  const player = game.users.find(user => user.name === playerName);

  if (!player) {
    console.error(`Spieler ${playerName} nicht gefunden`);
    return;
  }

  // Findet die Playlist anhand des Namens
  const playlist = game.playlists.getName(playlistName);
  if (!playlist) {
    console.error(`Playlist ${playlistName} nicht gefunden`);
    return;
  }

  // Findet den Song in der Playlist
  const sound = playlist.sounds.find(s => s.name === songName);
  if (!sound) {
    console.error(`Song ${songName} nicht gefunden in Playlist ${playlistName}`);
    return;
  }

  // Erstellt die Sound-Daten
  const soundData = {
    src: sound.path, // Dateipfad des Sounds
    volume: sound.volume, // Lautstärke
    autoplay: true, // Automatische Wiedergabe
    loop: sound.loop // Loop-Option
  };

  logMessage(`Sending playSound command to user ${player.id} with src: ${sound.path}`);
  // Sendet die Daten über den Socket
  game.socket.emit('module.chris-sound-module', {
    action: 'playSound',
    data: soundData,
    userId: player.id
  });

  logMessage(`Song ${songName} wird für ${playerName} abgespielt`);
}

// Funktion zum Senden von generischen Befehlen an einen Spieler
export function controlSoundForPlayer(playerName, action, additionalData = {}) {
  // Findet den Spieler anhand des Namens
  const player = game.users.find(user => user.name === playerName);

  if (!player) {
    console.error(`Spieler ${playerName} nicht gefunden`);
    return;
  }

  // Erzeugt die Payload für den Socket
  const payload = {
    action, // Aktion (z. B. 'stopSound', 'changeVolume')
    userId: player.id, // Zielbenutzer-ID
    ...additionalData // Zusätzliche Daten
  };

  // Sendet die Nachricht über den Socket
  game.socket.emit('module.chris-sound-module', payload);
  logMessage(`Befehl "${action}" an ${playerName} gesendet.`);
}

// Funktion zum Ändern der Lautstärke eines Spielers
export function changeVolumeForPlayer(playerName, volume) {
  // Delegiert an die controlSoundForPlayer-Funktion
  controlSoundForPlayer(playerName, 'changeVolume', { volume });
}

// Exportiere die Funktionen global für die Verwendung in anderen Modulen
window.controlSoundForPlayer = controlSoundForPlayer;
window.changeVolumeForPlayer = changeVolumeForPlayer;
window.playSoundForPlayer = playSoundForPlayer;
