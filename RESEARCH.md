# Snip Squad — platformer research and engine

## What makes the reference game work

The useful reference is the relationship between **movement, shape, and physical tools**. Walking into an outline alone misses much of Snipperclips.

| Reference observation | Consequence for this implementation |
| --- | --- |
| Characters walk, jump and rotate through arbitrary angles. Partners can provide extra height. | Gravity, grounded jumps, continuous rotation, partner platforms and a fixed, front facing camera. |
| One character overlaps another and cuts the intersecting material from the other character. | Transform both polygons into world space, subtract the cutter, then return the result to the victim's local coordinates. The selected character is the cutter. |
| A rounded cavity can catch a ball; the resulting shape becomes a useful physical tool. | Cut geometry drives both the visible extruded mesh and the actual sphere collision surface. |
| Reforming allows experimentation and recovery. | Restore the original body at its current position, including after complete removal. No limited lives. |
| Puzzles involve switches, balls, baskets and other objects, with multiple valid approaches. | Level 1 is an object delivery puzzle with a pressure switch, bridge, steps and flowerpot. Completion checks the seed's physical position, rather than a prescribed cut or action sequence. |
| Failure can be playful and cooperative. | Fallen characters return; a lost seed returns to its chute. A bad cut can always be reformed. |

### Sources consulted

1. [Nintendo World Report — Snipperclips hands-on](https://www.nintendoworldreport.com/hands-on-preview/43998/snipperclips-switch-hands-on-preview). Describes walking, jumping, rotation, overlapping cuts, reforming, and an elevated switch releasing a basketball that must be caught and delivered.
2. [Nintendo Life — SFB Games developer interview](https://www.nintendolife.com/news/2017/11/feature_sfb_games_on_going_back_for_more_in_snipperclips_plus_cut_it_out_together). Adam and Tom Vian discuss players asking for scoops, physical tool making, variety, and enjoyable failure. This influenced choosing a seed delivery puzzle instead of another silhouette matching exercise.
3. [GameSkinny — beginner's guide](https://www.gameskinny.com/tips/snipperclips-beginners-guide-everything-you-need-to-know-to-snip-through-any-challenge/). Describes making rounded scoops to hold balls and solving puzzles in different ways, including occasional solutions without cutting.
4. [Thinky Games — Snipperclips review](https://thinkygames.com/reviews/snipperclips-cut-it-out-together-is-a-colourful-and-crafty-delight-with-friends/). Discusses full rotation, partner jumping and cooperative experimentation.
5. [Snipperclips: Cutting Tools into Desired Polygons using Themselves](https://arxiv.org/abs/2105.08305). A mathematical treatment of cutting tools by intersection/subtraction under rotations. Used to ground the geometry model; it does not document Nintendo's internal engine.
6. [Nintendo's official overview](https://www.nintendo.com/us/store/products/snipperclips-cut-it-out-together-switch/). Cooperative cutting/reforming and party play. Original game assets, names and levels are not used here.
7. [MDN — Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API) and [standard mapping](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad/mapping). Polling, positional button mapping, dead zones and device exposure.

These are observations about player facing behavior. They do not establish which physics library, internal collision decomposition or networking architecture the original game uses.

## Actual 3D presentation, planar physics

`renderer.js` uses locally vendored Three.js with an orthographic camera, real extruded paper meshes, beveled edges, depth, a rigid spherical seed, a hollow pot, greenhouse scenery, directional light and soft shadows. The camera contains the entire level in one 16:9 scene. There is no free depth movement: gameplay takes place in the X/Y plane, with Z reserved for the miniature theatre presentation.

Matter.js runs the physical world at 60 fixed steps per second. The same simulation runs on the server and predicts between snapshots in the browser. Positions use a 1280×720 design space, positive Y downward. A 50ms authoritative room tick integrates elapsed time and sends poses at approximately 20Hz.

Movement uses a horizontal velocity controller, gravity and grounded jumping, with 110ms coyote time and a 130ms jump buffer. Rotation changes the body around its authored pivot at approximately 123 degrees per second. Paper characters retain their orientation instead of tumbling freely; the seed can tumble. Low surface friction prevents walking into a wall from cancelling a jump. Input expires after half a second without updates.

Characters overlap horizontally for cutting. Descending characters can land on a partner's polygon surface; Down bypasses that one way support to allow cutting alignment or dropping through. This is an explicit platformer rule layered on the physical world. Characters collide with terrain and the seed using their actual remaining material.

For a jump while supporting the seed, contact transfers the jump impulse to the touching seed. This reduces unstable launch impulses from moving a triangulated compound into a resting ball. The seed remains a free rigid body: it can roll, escape a shallow scoop, collide with the world or miss the destination. It is never attached to a hidden carry socket.

## Cutting and shape representation

- Four original domed paper shapes, each approximately 86×112 world units.
- Local shape representation: MultiPolygon → outer ring plus zero or more holes. The rounded dome uses 24 line segments.
- Cutting: `remaining = victimWorld − cutterWorld`, with polygon-clipping. Rotation is continuous; there is no occupancy grid and no 90 degree restriction.
- Preview: the exact polygon intersection appears striped over the victim before a cut.
- Earcut triangulates remaining polygons, including holes, into Matter compound parts. Three.js extrudes the same boundaries.
- Rebuilding preserves the authored pivot despite a changed center of mass. The current velocity is retained.
- If a cut splits a character into disconnected islands, the largest connected polygon remains. Very small or entirely removed characters can be reformed. Decorative scraps are not separate physical tools.
- Cut events send the removed polygon for paper fragments. Shape revisions and full geometry snapshots let late arrivals recover the current body without replaying every cut.

These choices implement the core clipping interaction with finite polygon precision. They are a foundation for additional puzzles, rather than a claim to reproduce every original game behavior.

## Level 1 — Special Delivery

A small paper greenhouse has two ground banks, an initially missing bridge, a raised release button, a seed chute, two garden steps and a hollow flowerpot.

1. Jump vertically and move onto the left shelf to press the red button. This releases the golden seed and opens the bridge.
2. Use an upside down partner as a rounded cutter over another character's top to make a scoop. The amount of overlap determines cavity depth. A deeper scoop is easier to carry with.
3. Catch the seed, cross the bridge and jump up the two right shelves. Partners can provide stepping stones or help recover a dropped seed.
4. Deliver the seed into the pot's interior. Keeping its center inside the opening for 0.45 seconds completes the level and grows a flower.

The opening is generous for a first puzzle, and the goal accepts physical delivery while holding the seed in a scoop. It does not require pouring, a particular character, a particular cut count or all four characters touching a target. The switch stays activated. Failed deliveries do not require restarting the room.

## Realtime lobbies, seats and authority

One project realtime room multiplexes independent four letter lobbies. Each has up to four player seats and any connected spectators. A seat belongs to a remote connection or a local guest of that connection.

| Occupied seats | P1 characters | P2 characters | P3 characters | P4 characters |
| --- | --- | --- | --- | --- |
| 1 | 1, 2, 3, 4 | | | |
| 2 | 1, 3 | 2, 4 | | |
| 3 | 1, 4 | 2 | 3 | |
| 4 | 1 | 2 | 3 | 4 |

Assignments rebalance during a round without resetting positions or cuts. Ownership changes clear held controls. Locks default off. Locked or full lobbies accept newcomers as spectators; a lock also prevents adding local player seats. Hosts transfer when the previous host leaves. The menu shows the newest eight lobbies with host avatar, additional player count, and FULL/LOCK status.

Clients send held horizontal/rotation/crouch inputs and discrete jump/snip/reform actions. The server validates connection ownership, character ID, round, action type and action cooldown. Snips and reforms are authoritative. Clients cannot submit geometry, completion times or wins. Continuous pose updates are small; joins, resyncs and cuts include full polygon geometry. Browser prediction reconciles to server state, including reversing an early predicted bridge activation.

Verified clears write to SQLite `platform_progress` and `platform_clears` in one awaited batch. Signed-in users are attributed by their trusted account ID. Local guests share their owning account's progress; spectators do not receive clears. A save finishing after a restart cannot overwrite the new round's save state. The prior grid version's tables are retained separately. Active rooms and rounds remain ephemeral across server restarts; saved clears are durable.

## Controls

| Device | Movement | Jump | Snip | Rotate | Switch | Reform |
| --- | --- | --- | --- | --- | --- | --- |
| Keyboard | A/D or left/right arrows | Space, W or Up | Z or X | Hold Q/E | Tab; 1–4; character buttons | R |
| Touch | Left/right | Jump | Snip | Hold curved arrows | ⇄ | ↺ |
| Standard gamepad | Stick or D-pad | Bottom face button | Left face button | Shoulders | Right face button | Top face button |

Hold Down/S on keyboard, Down on touch, or stick/D-pad down for precision movement and to drop through partners. On gamepads, Start joins/adds a local guest, or starts the round for an already seated host. Up to four exposed gamepads are polled. Guest labels use `USERNAME (GUEST X)`.

Xbox, PlayStation and Nintendo standard mappings use positional buttons, avoiding label disagreements. Nonstandard pads have a seven action button assignment flow saved per controller ID in the browser. Bluetooth pairing happens in the operating system. Separate Joy-Con availability and axis/button exposure depend on OS and browser; software here cannot guarantee that every controller is exposed or pair a controller itself.

## Checks performed

Direct Node harnesses checked:

- Gravity/grounding; a jump rising approximately 166 units; continuous full rotation; no jump reset in midair; control expiry.
- Partner standing and Down drop-through.
- Rotated polygon subtraction area, pivot preservation, holes remaining empty in the triangulated collider, complete removal and reform.
- Pressure button and bridge release reached with movement/jump inputs.
- A constructed, physically cut scoop catching the seed, carrying it across the bridge, climbing both risers and delivering it into the pot using movement/jumps. Test fixtures establish cutting alignment; the delivery phase runs actual simulation and does not teleport the seed or set the win flag.
- All four seat allocations, full/locked spectator entry, late join geometry, rejected unauthorized actions, local guest labels/device routing.
- Rejection of a client supplied win; authoritative goal completion producing one awaited database batch with trusted account attribution and no duplicate clear.
- Reconciliation removing a prematurely predicted bridge/seed.

The live preview `/api/progress` returned HTTP 200 with the new schema. Syntax checks passed for the browser modules and backend. Physical controllers, cross-device latency and extended human playtesting still need real devices; the automated checks do not establish those results.

The reproducible checks are retained under `tests/`. Run with Node 22 or newer, without installing packages:

```sh
node tests/platform.mjs
node tests/geometry.mjs
node tests/progress.mjs
```

The progress check uses a database stub and a temporary copy of the backend to inspect authoritative state. It does not write test clears into the live project database.
