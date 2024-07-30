# Chris Sound Module

## Overview

The Chris Sound Module is a Foundry VTT module designed to send and receive custom sound messages. This module allows a Game Master (GM) to play specific sounds for individual players, enhancing the immersive experience of your tabletop role-playing game.

## Features

- **Play Sounds for Specific Players:** Allows the GM to play a sound for a particular player without others hearing it.
- **Custom Notifications:** Provides feedback and notifications on successful sound playback and any errors that occur.
- **Easy Integration:** Simple to use with macros for quick execution.

## Installation

1. Download the latest release of the module.
2. Activate the module in your World settings.

## Usage

1. Ensure the module is activated in the Module Settings.
2. Create a macro to use the `playSoundForPlayer` function. This function takes three arguments: playerName, playlistName, and songName.
3. Example macro:
   ....
    const playerName = "Player6";  // Player's name
    const playlistName = "Ambient Sounds";  // Playlist name
    const songName = "Tor";  // Song name

    playSoundForPlayer(playerName, playlistName, songName);
   ....
5. Save the macro and add it to your hotbar.
6. Execute the macro to play the sound for the specified player.

## Troubleshooting

- Ensure the player names, playlist names, and song names match exactly with those in your Foundry VTT setup.
- Check the console logs for any error messages and follow the guidance provided to resolve them.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Credits

Developed by Chrisrous.
