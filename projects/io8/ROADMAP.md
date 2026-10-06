# Roadmap

Where io8 is heading, from "physics toy" towards a proper game with hand-built daytime levels.

## Blender to-do

See [BLENDER-TODO.md](BLENDER-TODO.md).

## 0. Custom map (next up)

The code is ready for a hilly map (`ground.js`, `Spawn` empty, see "Making a map" in the README). Once the map is built in Blender:

1. **Remove the random spawner.** Delete the chunk/decoration code in `spawner.js` (`OBSTACLES`, `DECORATIONS`, `updateChunks`) and keep the model loading, layout helpers (`pyramid`, `fullPyramid`, `tower`, `wall`, `stairs`), ground placement and despawn. (The spawned street lights, boxes and trashcans are already gone. Street lights go in the map instead, lit by a small pool of real lights that follow io8)
2. **Hand-placed props from empties.** Name an empty `Prop_<Model>_<Layout>` and the code builds that layout on the ground under it (models live in `assets/gltf/props/<Model>/<Model>.gltf`, e.g. `props/Cardboard/Cardboard.gltf` for `Prop_Cardboard_Pyramid`):
	- Examples: `Prop_Cardboard_Pyramid`, `Prop_Cardboard_Tower`, `Prop_Cardboard_Wall`, `Prop_Cardboard_Stairs`, or just `Prop_Cardboard` for a single one
	- No spaces in names. Blender's `.001` suffixes are ignored (GLTF export mangles spaces and dots)
	- Optional custom properties on the empty: `rows` (pyramid), `count` (tower, stairs), `width` and `height` (wall). Leave one out and it's random like now
	- Empty's x/z = where, y is ignored (snaps to the ground), rotation around the vertical axis turns the whole layout, scale is ignored
	- Tip: set the empty's display to Cube and size it roughly like the layout so you can see it in Blender
	- Keep the despawn-by-distance idea: build a marker's props when io8 gets near, remove them when far behind, rebuild fresh when coming back. That way a long map costs no more than a short one
3. **Sun with shadows that follow io8.** A Sun lamp from Blender (lights cast shadows unless `shadow: 0`). three.js only renders directional shadows inside a small fixed box, so move the light (and its `target`) along with io8 every frame, and size `shadow.camera` to roughly the visible area

Map-building notes (Blender side):

- Background props with no physics go straight into the map: anything that isn't a `_RigidBody` is only drawn
- Lamps without real lights: emissive glass (Emission strength up in the Principled BSDF), the bloom pass does the glow. Nearly free. The bloom threshold is 0.85 in `SleekScene` if it needs to glow more in daylight
- Set `shadow: 0` on distant scenery so it skips the shadow maps
- Join static scenery that shares a material (Ctrl+J) per stretch of road to cut draw calls, but not across the whole map or it can't be culled off screen
- Watch texture sizes, everything loads upfront (the current map is already 39 MB)

## 1. Thruster fuel

Thrusters currently work forever, so you can just fly over everything.

- A fuel tank that drains while thrust (W) is held, a couple of seconds of thrust when full
- Refills when io8 is on the ground (not while airborne), maybe after a short delay so you can't tap-refuel
- Show it in the UI, e.g. a bar in one of the empty `#ui` cards in `index.html`
- Flames sputter or flicker when nearly empty, and stop when it runs out

Notes:

- Lives in `IO8.physicsStep()` in `src/game/io8.js`, next to the existing thrust code. Add `fuel: {capacity, drain, refill}` to the `IO8` config
- "On the ground" = the wheel is touching something. Either check Rapier contacts for the wheel collider (`world.contactPairsWith`) or cast a short ray down from the axle. The ray is simpler and also works on top of boxes

## 2. Pickups (power-ups)

Done: floating pickups in glowing bubbles, spawned at random in the air along the road by the spawner (`pickups.js`). Each is a model in `assets/gltf/pickups/<Name>/<Name>.gltf` (listed in `MODELS`), with custom properties on its root object: `effect` (see `EFFECTS` in `io8.js`), `amount`, `duration` (none = instant) and optionally `pitch` (pickup sound). Effects so far: `speed`, `weight`, `health`.

Ideas for more:

- **Fuel**: refills the tank or makes it bigger for a while
- **Shield**: smash through anything without slowing down (e.g. temporarily raise `driveFactor`)
- **Super thrust**: stronger thrust, no fuel drain, for a few seconds
- **Slow-mo**: lower `physics.config.speed` for a moment (the old todo list wanted slow-mo too)
- **Points**: collectibles for a score
- **Big io8**: briefly scale up... probably hard with joints, skip unless it's easy

## 2b. Lasers

The head already follows the mouse (360°, see `turnHead()` in `io8.js`). Next: shoot from it.

- Click to fire. **Always shoots where the head actually points** (`io8.headDirection`), not at the cursor, so the head's spring wobble after braking or a quick flick makes aim a skill
- **Flying bolts**, not an instant beam: a thin glowing capsule (about 20-30 cm long, 1-2 cm thick, 40-60 m/s), made in code with one shared geometry and an unlit material bright enough for bloom. Longer than it travels per frame, or it looks like jumping dots. No real light per bolt (changing the light count recompiles shaders)
- Fired from a gun on the head. In Blender: a `Muzzle` empty at the barrel tip, parented to the head, local X pointing the way it fires (fallback until then: the head's position and `headDirection`)
- No physics body for the bolt, it's too fast (it would pass through boxes between steps). Each step a Rapier ray cast from where it was to where it is now, ignoring io8's own colliders. On a hit: stop there, push whatever it hit with an impulse at the hit point (boxes fly), impact sound, maybe a spark. Later maybe damage/break things
- Maybe a faint laser sight from the eye while aiming, a cooldown or heat bar, recoil (small opposite impulse on the head, which the neck spring will make look nice)
- If aim feels too sloppy: stiffen `config.neck` while the fire button is held

### Explosion visuals (done)

In `src/game/effects/`: fireball, sparks, one pooled flash light and camera shake, `blasts.spawn(position, size)` (io8 = 1, laser hit = 0.35). `Explosion` is physics only (debris, shockwave). Smoke and a ground shock ring were tried and dropped. A flipbook fireball is still an option if the look needs more

## 3. Obstacles in the air

Right now everything sits on the ground, so flying is always safe.

- Things hanging or floating at thruster height: signs, pipes, hanging crates, a low bridge or beam across the road
- Some solid (block you), some breakable (knock them down)
- Makes fuel matter: fly too high or too long and you hit something

Notes:

- Fixed bodies (mass 0) for solid ones, dynamic ones on a joint (e.g. crates hanging from a rope via `JointData.rope` or `spherical`) would swing when hit
- Solid ones can simply be part of the map. Breakable or swinging ones as `Prop_` empties with a height (don't snap those to the ground)

## 4. Sky

Done: gradient sky with a day/night cycle from the map's `sky.json`, `SkyPivot` turning the sun and moon (it follows the camera, so nothing drifts), the real night sky (`stars.js`, Yale Bright Star Catalog, optional `date` in `sky.json`). To do:

- **Clouds** (waiting on the Blender side): puffy blobs scattered with Geometry Nodes under a `Clouds` empty with a `drift` custom property (m/s), exported as GPU instances. Code: check the build keeps `EXT_mesh_gpu_instancing` when it makes the .glb, move the instances with the wind, and shrink them away at the downwind edge of the field / grow them back in at the upwind edge so nothing pops, from any camera angle
- **Sunlight colour keyframes**: the Sun lamp has one fixed colour, so direct light stays white-ish at dusk (the warm tint now only comes from the sky's environment light). Give the sun (and moon) a colour per hour in `sky.json`, blended like the gradients, for golden-hour light on clouds, terrain and io8

## 5. Background props

Now part of the map itself (see "Map-building notes" above): buildings, fences, walls, parked cars, trees, distant silhouettes for depth.

## Later / maybe

- **A goal**: score by distance, plus bonus for smashed boxes. Maybe something that makes you lose: io8 tipping over, falling into a gap in the road, or running out of fuel mid-air over a gap
- **Road gaps / ramps**: pits you have to thrust over, ramps to launch off
- **Sound**: engine hum that follows speed, thruster roar, crashes (three's `PositionalAudio`, also on the old todo list)
- **Old todo list items still worth doing**: grappling hook / weapon with right click and slow-mo, eye that follows the mouse, loading bar (the loader already reports progress)
- **Housekeeping**:
	- Set `friction` on the wheel in Blender instead of hardcoding it in `io8.js`
	- Rapier is the `-compat` build (2.8 MB, its WASM inlined as text in `lib/rapier/rapier.mjs`). The plain `@dimforge/rapier3d` build loads a separate, smaller `.wasm` file, if load time ever matters
	- `__OLD/`, `js/`, `lib/` and the old `assets/` copies can go once nothing more is needed from them
