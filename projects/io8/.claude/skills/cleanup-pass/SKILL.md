---
name: cleanup-pass
description: Hunt io8's code for hard-coded special cases and structural mess - rules tied to one entity, parameters that exist for one caller, per-model facts in code tables, systems reading each other's internals, parallel paths for the same thing - verify every finding, let the user pick, then fix it the general way. Use when the user asks for a cleanup pass, to look for special cases or hard-coded stuff, or to check the code is still clean and logical. For speed and allocations, use perf-pass instead.
---

# io8 cleanup pass

The pass in October 2026 followed these steps, and so should the next one. It started with a mine rule ("touching a mine is fatal") that turned out to be a special case bolted onto Explosives. The mine's blast already did the job. The user wants clean, logical code with nothing hard-coded, and they want to be told when something they ask for would break that rule.

## Ground rules

- **Find, verify, then ask.** Present the findings and let the user choose before changing anything. Explain anything they might not follow in plain terms: what the code does now, why it's tangled, and what it would look like after.
- **Say when a fix changes the game.** Most cleanups shouldn't change behavior. When one does, flag it before doing it. For example, io8's explosion going through the general blast path means he now sets off mines when he dies.
- **Blender first.** A fact about one model (what it sounds like, whether it explodes, what it weighs) goes in a custom property on the model, not in a table in the code. Patch the exported `.gltf` by hand so the build works, add the property to the custom properties table in `README.md`, and put the change on `BLENDER-TODO.md`.
- **Respect settled decisions.** Check memory before calling something a finding. io8's and the drones' health are mirrored on purpose. `follow()` in the sky stays. The physics decisions are settled.
- **Leave it uncommitted.** Run `npm run build`, play-test, and leave the result for the user to review. Commit only when they ask.

## What counts as a finding

These are the patterns found so far. Each came with a general route that was clearly better:

- **A rule tied to one entity.** For example, `player.damage(player.health)` when a mine is touched, when the mine's blast already hurts whatever is near it.
- **A parameter that exists for one caller.** `Lasers.step(deltaTime, player, fire)` held io8's ammo and trigger, and the drones passed `player` in only to fill the parameter. The fix was to give the gun to whoever holds it.
- **Per-model facts in code tables.** `IMPACT = {cardboard: 'cardboard', mine: 'robot'}` in the spawner, and `'robot'` or `'tyre'` hard-coded where something registers its sounds. These became an `impact` custom property.
- **A system reading another system's internals.** Pickups read io8's wheel, legs and head by name, when `SleekEntity.distanceTo()` already answers the question. App's warm-up built stand-ins from `lasers.geometry` instead of asking each system for its `standIns()`.
- **A parallel path for the same thing.** io8 blowing up had its own explosion code: it registered impact sounds by hand, stepped itself, and never called `App.blast()`. A parallel path usually hides a behavior gap, so look for what it does differently.
- **A list with an exception.** Blasts kept smoke outside its `layers` list only because Smoke's burst method had a different name.
- **The same magic number in two places.**
- **Game knowledge in `src/sleek/`.** That's the reusable engine, and nothing in it should know about io8.
- **A comment that no longer matches the code.** Behavior moves on and comments get left behind. The spawner said a mine "goes off if io8 touches it" long after Explosives was changed to set it off on anything that moves. Check every comment that describes behavior against the code it describes, and look for comments that name things which have since been removed or switched off.

These are **not** findings:

- Documented naming conventions: `_RigidBody`, `_Mesh`, `_Shape`, `Muzzle`, `Drone_Eye`, `Water`, `SkyPivot`, `Spawn`.
- Tunable config values.
- A default name, such as the `crackle` spark sound.
- Anything that's only there to keep a single case explicit and readable, where the general version would be harder to follow. For example, the HUD has one line per stat, and looping over only the power-ups would make them the exception.

## The steps

1. **Review in parallel.** Start three read-only fork subagents with the checklist above, each on one slice. Have each one read its files in full, check the comments against the code, report file:line, the general route and a rough size, rank by complexity removed, and stay under 400 words.
   - io8 and the app: `io8.js`, `app.js`, `main.js`, `hud.js`, `touch-device.js`, `camera.js`
   - Enemies and props: `drones.js`, `lasers.js`, `explosion.js`, `explosives.js`, `spawner.js`, `pickups.js`, `impacts.js`, `debris.js`, `emitters.js`
   - World and engine: `sky.js`, `stars.js`, `sunlight.js`, `water.js`, `ground.js`, `effects/*`, `src/sleek/*`

   Add any new files to whichever slice fits.
2. **Verify every finding in the code yourself.** Reviewers are sometimes wrong (see perf-pass, where a missing `Muzzle` empty was called dead code). Bugs they spot outside the hunt are worth passing on too. One pass found a water material that got patched twice.
3. **Present one ranked list:** worth doing, small tidy-ups, and ones you'd skip (with the reason). Note any that change gameplay. Wait for the user to choose.
4. **Fix the general way.** Update the comments that described the old behavior, the README custom properties table, and `BLENDER-TODO.md` for every new custom property, and hand-patch the `.gltf` files.
5. **Build and play-test.** Use the Playwright setup from the io8-playtest memory. Check each change directly in the page, for example:
   - materials registered with Impacts, and the `impact` of every debris piece
   - ammo and bolts after each click
   - pickups being picked up
   - a mine going off when io8 dies next to it
   - no console warnings

## Traps (all hit for real)

- **`Explosion.shatter()` moves pieces out of the model one at a time.** A piece inside another one (a rim inside the tyre, lights on the legs) loses its ancestors once the outer piece has gone. Anything a piece needs from the model, such as inherited custom properties or the speed of the part it came from, has to be worked out for all the pieces before any of them move. Moving them one at a time left 12 of io8's 16 pieces silent, and without his momentum.
- **Renaming a value used by both the code and the models** (`robot` to `metal`) means patching every `.gltf` that uses it, and adding a line to `BLENDER-TODO.md` for each.
- **Moving per-frame work between systems.** Keep the order of steps the same (shooting before the bolts move, ammo refilling once per frame), and check that a system which stopped receiving `player` didn't need it anywhere else.
- **A test that waits in real time can miss short-lived states.** A pickup that pops and is removed within the wait looks like it was never picked up. Check whether it's gone, not only whether it's popping.
