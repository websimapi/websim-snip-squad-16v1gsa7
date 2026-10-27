# Snip Squad — engine notes

## Reference research

- Nintendo, [Snipperclips official site](https://media.nintendo.com/snipperclips/) and [Nintendo game overview](https://www.nintendo.com/us/store/products/snipperclips-cut-it-out-together-switch/): cooperative cutting, reforming and shape based puzzle solving; party play supports up to four. This project uses its own art, names, puzzle and implementation.
- MDN, [Using the Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API) and [Gamepad.mapping](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad/mapping): poll gamepads in the animation loop, retain button edges, respect dead zones and use positional standard mappings. Hardware availability and separate Joy-Con exposure depend on browser, OS and pairing. The game cannot pair Bluetooth devices itself. Nonstandard devices have a user initiated button assignment flow.

## Deliberate first-level scope

This is a top-down grid puzzle. Shapes overlap freely, move one cell, and rotate by 90 degrees. There is no platformer gravity. A 7×7 occupancy mask stores each character's remaining material. Snip computes exact set subtraction in world coordinates; the selected character is the cutter. Other overlapping characters lose those cells. Reform restores the original mask in its current rotation, adjusting away from the boundary if necessary. Disconnected pieces remain part of their character. All four targets require exact cell equality, including no excess material.

The engine and level data live in the import-free `server.js`. Browser modules re-export them, avoiding separate implementations drifting apart. `renderer.js` traces mask boundaries into canvas paths, interpolates cell movement, displays cut previews and makes small paper fragments. No generated assets or third party geometry libraries are needed.

Level 1 teaches one required cut: Poppy starts as a 4×3 rectangle and needs to become 2×3. Blu is a 2×3 cutting tool. Sunny and Sprout teach positioning. One verified solution takes 52 actions: Blu left 4, snip, Blu right 13, Poppy right 12, Sunny right 12, Sprout right 10. Many other solutions are allowed.

## Multiplayer and authority

One Websim realtime room multiplexes independent four-letter lobbies. Each lobby has up to four participant seats. A seat can belong to a remote connection or a local guest on the same connection. Four character assignments are distributed over occupied seats in join order:

| Players | P1 | P2 | P3 | P4 |
| --- | --- | --- | --- | --- |
| 1 | 1,2,3,4 | | | |
| 2 | 1,3 | 2,4 | | |
| 3 | 1,4 | 2 | 3 | |
| 4 | 1 | 2 | 3 | 4 |

Assignments rebalance without resetting positions or cuts when participants join or leave. Spectators have no character ownership. Locks prevent new player seats, including local guests, but allow spectators. Full lobbies also accept spectators. Hosts transfer when the host leaves. Newest lobbies appear first, capped at eight.

The server validates connection ownership, round, action type, directions and an input interval. It applies every accepted action to authoritative state and checks completion itself. Clients predict their own accepted-looking input and reconcile pending actions against ordered confirmations. Mid-round joins and resyncs receive a compact mask snapshot, rather than an ever-growing action history. Clients cannot submit scores or claim a win.

Movement is ephemeral memory. Verified clears are written to SQLite `progress` and `clears` in one awaited batch. Both tables attribute rows to the signed-in user's trusted ID. Local guests share the owning account's progress; signed-out visitors can play but cannot write durable progress. Lobbies and active rounds are ephemeral and can close on a room restart or deployment. Reconnect tries the same lobby, with a visible closed-lobby error if it no longer exists. Saved clears survive room restarts.

## Controls

- Desktop: WASD/arrows move; Space snips; Q/E rotate; Tab cycles the current participant's characters; 1–4 selects an assigned character; R reforms. Clicking a character button switches control, including between local guests when sharing one keyboard.
- Touch: direction pad, switch, rotate, reform and snip. Hold directions to repeat.
- Gamepads: four devices maximum, stick/D-pad movement, bottom face button snip, right/left rotate, top reform, shoulders switch. The first pad uses the main seat; Start on another pad adds a local guest if space is available and the lobby is open. Button assignment is saved per controller ID on this browser.

## Verification

A direct Node harness verified geometry subtraction, rotation identity, reform after complete removal, the level's 52-action solution, all participant distributions, late join mask snapshots, locked entry, full lobby spectators, guest labels and device assignment, unauthorized action rejection, server-derived completion and attributed DB writes. `/api/progress` was also requested through the live preview backend. Real network latency and physical controllers still need device testing; automated checks do not establish support for every Bluetooth controller/browser combination.
