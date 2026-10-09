# IO8

three.js r186 + Rapier 0.20, plain ES modules. No build step while developing, but players get the build in `dist/`.

Serve the folder with any static server and open it, e.g. through Apache, `npx serve` or `python3 -m http.server`. Opening `index.html` straight from disk won't work, browsers don't allow modules over `file://`.

## Build

`npm install` once, then `npm run build` makes `dist/`. It's committed and deployed like everything else, so run the build before committing anything players should get (rebuilding without changes gives identical files, so git only stores what changed). See `build.mjs`:

- Every `.gltf` in `assets/` becomes one `.glb` with its textures inside. Textures bigger than 2048 px are scaled down and everything is converted to WebP, so a 4K texture from Blender is fine. Geometry and everything else in the model is left exactly as exported
- `src/` and `lib/` are bundled into one minified `main.js`
- The rest of `assets/` (audio, `sky.json`...) is copied as is

The code keeps asking for `.gltf` either way, the built version loads the `.glb` instead (see `SleekLoader`).

Add `?fps` to the address for an FPS counter, `?shapes` to see the collision shapes (what the physics actually uses) over the game, or `?shapes_only` to see nothing but them. `?fps` works with either (`?fps&shapes`). The number keys switch camera views, set up in `assets/camera.json` (see `src/game/camera.js` for what each value does). `window.app` is exposed for poking at things in the console, e.g. `app.player.config.balance.stiffness = 400` (springs and motors are re-read every step).

## Structure

- `src/sleek/` - reusable engine bits (scene/renderer, physics, GLTF loader, entity builder, audio)
- `src/game/` - the actual game: `io8.js` (the robot), `spawner.js` (obstacles along the map, tweak `CONFIG`, `OBSTACLES` and `DECORATIONS` there), `ground.js` (ground height anywhere on the map)
- `assets/` - models, textures and audio
- `lib/` - three.js and Rapier, copied in as-is. The import map in `index.html` maps `three`, `three/addons/` and `@dimforge/rapier3d-compat` to them. Only the three.js add-ons in use (and what they import) are there; to add one, copy it (and its imports) from the three.js repo's `examples/jsm/` into the same place under `lib/three/examples/jsm/`. To upgrade, replace the files with the same ones from a newer version

## Blender conventions

`SleekEntity` builds rigid bodies from the GLTF node names:

```
Thing_RigidBody      direct child of the scene, becomes a rigid body
	Thing_Mesh       what you see
	Thing_Shape      hidden, every mesh inside becomes a collider on the same body
```

`_Shape` is optional. Without it, the `_Mesh` itself is used for collisions, which suits a road or terrain where the collision should match what you see. Use a `_Shape` when a simpler (cheaper) shape will do, or the collision should differ from the looks.

`_Mesh` is optional too: the `_RigidBody` object can be the mesh itself (e.g. a mesh object named `Road_RigidBody`), and then every mesh in it collides.

Custom properties (Object Properties > Custom Properties, exported as GLTF extras):

| Property      | On                 | Meaning                                                              |
| ------------- | ------------------ | -------------------------------------------------------------------- |
| `mass`        | `_RigidBody`       | 0 or missing = fixed body                                            |
| `friction`    | `_RigidBody` (or one mesh in its shape) | how grippy it is: 0 slides like ice, 0.5 (default) is ordinary, 1 or more is rubbery (io8's wheel is 1.2, so it grips the road). When two things touch, the average of their two values counts. Read like `collider` |
| `restitution` | `_RigidBody` (or one mesh in its shape) | how bouncy it is: 0 (default) lands with a thud, 0.5 bounces back at half its speed, 1 bounces back at full speed. When two things touch, the average of their two values counts. Read like `collider` |
| `collider`    | `_RigidBody` (or one mesh in its shape) | `hull`, `trimesh`, `cuboid` or `sphere`. Default: hull if dynamic, trimesh if fixed. Read from the `_RigidBody`, or from a mesh itself to give just that one a different collider. Not from the `_Shape` empty that groups the meshes |
| `shadow`      | mesh/light         | `0` = no shadows, `receive` = receives them but doesn't cast any (for big things like terrain, which would otherwise be drawn into every shadow map). Default on, for meshes and lights. Applies to everything under the object too (put it on a parent to switch off a whole part) |
| `decay`       | light              | how the light falls off with distance: `2` (default) is physical, `1` much more gently, so it reaches further without blinding what's close |
| `shadowSize`  | light              | shadow map size in pixels. Default 512 for point lights, 2048 for spot, 4096 for sun |
| `debris`      | any object on io8  | `whole`: when io8 explodes, this object and everything under it fly as one piece (e.g. on `RobotHead_RigidBody` to keep the head intact). Default: every mesh is its own piece |
| `emit`        | an empty (map, prop or io8) | `smoke`, `sparks` or both (`smoke, sparks`) come from here. Parent it to the part it should move with. Without a `rate` it shows how hurt io8 is (only on io8, any number of them, a random one each time): smoke as his health drops, crackles of sparks when he's badly hurt and a burst of sparks on every hit |
| `rate`        | an `emit` empty    | emits all the time instead, at random moments this many times a second on average: high for a steady stream (a fuze: `rate: 25`, `size: 0.2`), low for the odd crackle (an electric box: `rate: 0.3`, `size: 1.5`) |
| `size`        | an `emit` empty with a `rate` | how big each puff or spark burst is: 1 (default) is a normal one, like io8's when he's hurt |

Rigid body nodes should have a scale of 1, put any scale on the shape meshes instead.

## Making a map

The map is loaded from `MAP` in `src/game/app.js`.

- Export as GLTF into `assets/gltf/maps/<name>/`
- Same conventions as everything else: a `Something_RigidBody` with no `mass` (fixed), a `_Mesh` child for looks and optionally a `_Shape` child for collisions (otherwise the mesh collides as it is). Several rigid bodies are fine (road pieces, ramps, walls)
- The shape becomes a triangle mesh, so hills, dips and overhangs all work. It can be the same mesh as the visible one, or a simpler copy
- io8 drives along **+X at z = 0**. Keep the ground at least 3 m deep on the negative Z side (clutter stands at z = -1 to -1.8) and 1 m on the positive side (pyramids stick out ~0.75 m)
- The map's X extent is its length. Nothing spawns within 2 m of either end, and io8 will drive off the edge unless there's a wall there
- Add an empty called **`Spawn`** where io8 should start (its origin is the middle of the wheel, so put it ~0.5 m above the ground). Without one, io8 starts on the ground at x = 0
- Slopes up to about 20° are fine to drive up. Much steeper and io8 will need its thrusters
- Optional **`sky.json`** next to the map's `.gltf` gives it a gradient sky (without one the sky is black). `sky` holds a gradient per hour of the day (`"0"` to `"24"`), each 2-8 colours from the horizon up, blended between hours. `time` is the hour it starts at, `cycle` how many seconds a whole day takes (leave it out for a still sky), `date` (`"MM-DD"`) the time of year for the stars, and `environment` how strongly the sky lights the scene (default 1). See `src/game/sky.js`
- Optional **`Water`**: a mesh (a plain one, not a `_RigidBody`) with a normal map in its material. Its normal map drifts, read twice so the tiling doesn't show, and its reflections never point below the horizon. Everything else about it is as set up in Blender. See `src/game/water.js`
- Optional **`SkyPivot`** empty with the sun and moon on it, sun straight up (model it at midday, moon on the opposite side): it turns with the time like a clock hand, rising on the left. It moves with the camera like the rest of the sky, so the sun and moon don't drift. A Sun lamp parented to the sun or moon shines from it towards io8 and fades out as it sets

## Making a pickup

Pickups float in a glowing bubble along the road, placed at random by the spawner. See `src/game/pickups.js`.

- Export as GLTF to `assets/gltf/pickups/<Name>/<Name>.gltf` and add `<Name>` to `MODELS` in `pickups.js`
- One root object (the first object in the scene) with everything else under it. The custom properties below go on it
- No `_RigidBody`, it isn't physics: io8 picks it up by getting within 0.65 m of its middle (`reach`), and the bubble is that size, so keep the model inside it
- Any materials you like. If it should glow, use an emissive material, not real lights

| Property    | Meaning                                                                |
| ----------- | ---------------------------------------------------------------------- |
| `effect`    | what it does: `speed`, `weight` or `health` (see `EFFECTS` in `src/game/io8.js` for adding more) |
| `amount`    | how strong, depending on the effect: `speed` how many times faster (multiplies the top speed), `weight` how many times heavier, `health` the share of full health it gives back (0-1, never past full) |
| `duration`  | seconds it lasts. Leave it out for an instant one (`health`). Picking up an effect that's already running adds its time instead of its strength, so two speed boosts last twice as long but aren't twice as fast |
| `pitch`     | optional, the pickup sound's pitch: 1 (default) as recorded, higher is brighter |
| `frequency` | optional, how often it shows up compared to the others: 1 (default), 2 twice as often, 0.5 half as often |
| `color`     | optional, the colour of its bubble: a colour property (Float Array, subtype Linear Color, 3 values) or a hex string like `#ff3344`. Default white |

## Physics gotchas

- Rapier's per-axis locks (`setEnabledRotations` / `setEnabledTranslations`) explode as soon as the body has a joint. Full `lockRotations()` is fine. That's why the robot is kept upright and 2.5D by a hidden rotation-locked "gyro" body hinged to the legs, plus a generic joint that locks Z, rather than by locking axes on the parts themselves.
- The number of lights must stay constant or three.js recompiles every shader (a visible hitch).
- Motors are acceleration based, so stiffness/damping values are big-ish numbers that don't depend on mass.
