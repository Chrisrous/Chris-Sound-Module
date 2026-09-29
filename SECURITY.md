# Security and trust boundaries

Chris SoundPad is intended for a trusted gaming group. GM checks in the public API and
receiver validate ordinary use. The raw module socket does not authenticate a sender ID
provided inside a packet. A malicious connected client can forge commands or responses.
The module does not make targeted audio transport confidential or hide file paths.

Do not put secrets in audio filenames, URLs, aliases or messages. Do not publish world files,
credentials, signed CDN links or private player data in issue reports. Client acknowledgements
are not proof of audibility. Personal mute/device settings remain authoritative for the player.

Same-user concurrent pad editing has best-effort revision checks, not atomic server CAS.
Emergency Stop cannot reach disconnected clients. Back up worlds before trying candidates.

For a suspected vulnerability, prefer GitHub private vulnerability reporting when enabled.
Otherwise contact the repository owner without posting exploit details or credentials publicly.
No security response SLA or hostile-client resistance is promised.
