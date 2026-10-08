# Roadmap

Where io8 is heading, from "physics toy" towards a proper game with hand-built levels. Blender work is in [BLENDER-TODO.md](BLENDER-TODO.md), each item there says what code follows its export (cloud drift, box decal variants, damage emitters).

## Done

Hilly map with a `Spawn` empty, random obstacles and pickups along the road, thruster fuel, lasers with ammo, explosions (fireball, sparks, flash, camera shake), area-based blast physics, health from crash damage with smoke and sparks, speed/weight/health pickups, gradient sky with a day/night cycle, sun/moon shadows that follow io8, real night sky, start menu with pause.

## To do

- **Sunlight colour keyframes**: the Sun lamp has one fixed colour, so direct light stays white-ish at dusk (the warm tint only comes from the sky's environment light). Give the sun (and moon) a colour per hour in `sky.json`, blended like the gradients, for golden-hour light on clouds, terrain and io8
- **Obstacles in the air**: things at thruster height (signs, pipes, hanging crates, a low beam across the road), some solid, some breakable, so flying isn't always safe and fuel matters. Solid ones can be part of the map; swinging ones are dynamic bodies on a joint (`JointData.rope` or `spherical`)
- **A goal**: score by distance, plus a bonus for smashed boxes
- **Road gaps / ramps**: pits to thrust over, ramps to launch off

## Ideas

- **More pickups**: fuel (refill or a bigger tank for a while), shield (smash through anything), super thrust (no fuel drain), slow-mo (lower `physics.config.speed`), points
- **Hand-placed props**: empties named `Prop_<Model>_<Layout>` (e.g. `Prop_Cardboard_Pyramid`) that build a layout on the ground under them, with optional `rows`/`count`/`width`/`height`, built and removed by distance like the random ones. Would replace the random obstacles in `spawner.js` for hand-built levels
- **Emitters anywhere**: once there's something to put them on (a sparking pole, a smoking wreck), let empties in the map and props emit too, not just io8. `emit`: `damage` (smoke and sparks, as on io8 now), `smoke` or `sparks`; an optional `rate` (per second) makes it emit all the time, without one it follows io8's health like now. Needs a small shared system that finds emitters in every loaded model, instead of only io8's
- **An accurate sky** (the goal: sun, moon and stars all as they really are): the moon on its own orbit, a lap every 24 h 50 min on its own pivot with its light following it (the stars a lap every 23 h 56 min, the sun 24 h), so it drifts across the stars and rises later each day like the real one. Phases after that, as it's no longer always opposite the sun
- **Lasers**: a faint laser sight, recoil (a small kick on the head, the neck spring makes it look nice), a stiffer neck while firing if aim feels sloppy
- **Grappling hook** on right click
- A flipbook fireball if the explosions need more

## Map-building notes

- Anything that isn't a `_RigidBody` is only drawn, so background props go straight into the map
- Lamps without real lights: emissive glass (Emission strength up), bloom does the glow, nearly free. The bloom threshold is 0.85 in `SleekScene`
- `shadow: 0` on distant scenery so it skips the shadow maps
- Join static scenery that shares a material (Ctrl+J) per stretch of road to cut draw calls, but not across the whole map or it can't be culled
- Watch texture sizes, everything loads upfront

## Housekeeping

- **Map performance, if it's ever needed** (90 fps on mobile for now): split the terrain (~82k triangles) into tiles so off-screen parts aren't drawn, and smaller sun/moon textures (2048 × 1024 now, 512 × 256 is plenty at their size on screen)
- Rapier is the `-compat` build (2.8 MB, its WASM inlined in `lib/rapier/rapier.mjs`). The plain `@dimforge/rapier3d` build loads a separate, smaller `.wasm`, if load time ever matters
