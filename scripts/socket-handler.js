// Initialisieren des Socket-Listeners
Hooks.once('ready', () => {
  console.log("Chris Sound Module: Initializing socket listener...");

  game.socket.on('module.chris-sound-module', (data) => {
    console.log("Received playSound command for this user:", data);
    if (data.action === 'playSound' && data.userId === game.user.id) {
      console.log("Playing sound for user:", data.userId);
      try {
        // Sicherstellen, dass der Wert für volume eine gültige Zahl zwischen 0 und 1 ist
        const volume = isNaN(data.data.volume) || data.data.volume < 0 || data.data.volume > 1 ? 0.8 : data.data.volume;
        const sound = new Audio(data.data.src);
        sound.volume = volume;
        sound.loop = data.data.loop;
        sound.play().then(() => {
          ui.notifications.info(`Sound ${data.data.src} wird abgespielt.`);
        }).catch(error => {
          console.error(`Audio playback failed: ${error}`);
          ui.notifications.error(`Fehler beim Abspielen des Audios: ${error}`);
        });
      } catch (error) {
        console.error(`Error playing audio: ${error}`);
        ui.notifications.error(`Fehler beim Abspielen des Audios: ${error}`);
      }
    } else {
      console.log(`Message not for this user or incorrect action. Expected user ID: ${game.user.id}, received: ${data.userId}`);
    }
  });

  ui.notifications.info("Chris Sound Module: Socket-Listener initialisiert.");
});

// Funktion zum Senden einer Nachricht
export function playSoundForPlayer(playerName, playlistName, songName) {
  const player = game.users.find(user => user.name === playerName);

  if (!player) {
    ui.notifications.error(`Spieler ${playerName} nicht gefunden`);
    return;
  }

  const playlist = game.playlists.getName(playlistName);
  if (!playlist) {
    ui.notifications.error(`Playlist ${playlistName} nicht gefunden`);
    return;
  }

  const sound = playlist.sounds.find(s => s.name === songName);
  if (!sound) {
    ui.notifications.error(`Song ${songName} nicht gefunden in Playlist ${playlistName}`);
    return;
  }

  const soundData = {
    src: sound.path,
    volume: sound.volume,
    autoplay: true,
    loop: sound.loop
  };

  console.log(`Sending playSound command to user ${player.id} with src: ${sound.path}`);
  game.socket.emit('module.chris-sound-module', {
    action: 'playSound',
    data: soundData,
    userId: player.id
  });

  ui.notifications.info(`Song ${songName} wird für ${playerName} abgespielt`);
}

// Exportieren der Funktion zum globalen Zugriff
window.playSoundForPlayer = playSoundForPlayer;
