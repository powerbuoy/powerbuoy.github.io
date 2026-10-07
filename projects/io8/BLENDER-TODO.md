# Blender to-do

Custom properties go on the Object tab. After each export, the code side follows.

## Map (windowsxpmap)

- **Export path:** the map now lives in `assets/gltf/maps/windowsxpmap/` (was `assets/gltf/windowsxpmap/`), point the glTF export there
- **Streetlights:** copies of the lamp with its point light, set up like the Streetlight prop. Code then: light pool (a few real lights that move to the lamps nearest io8)
- **Utility poles and cables:** Geometry Nodes on an empty `UtilityPoles` mesh object. Poles: Mesh Line → Raycast onto `Terrain_RigidBody` → Instance on Points → Realize Instances. Cables: Mesh to Curve → Subdivide → sag `-sag * 4 * t * (1 - t)` → Curve to Mesh (≥ 1.5 cm thick). No `_RigidBody`, `shadow: 0`
- **Clouds:** a few puffy blob shapes in a collection, scattered with Geometry Nodes on a plane a bit bigger than the terrain (Distribute Points on Faces → Instance on Points, random scale/rotation, *no* Realize Instances). Under a `Clouds` empty with `drift` (m/s). Opaque matte white, no emission, `shadow: 0`. Export with GPU instances on. Code then: drift, shrink/grow at the edges
- **Performance:** `shadow: receive` on `Terrain_RigidBody` and `Road_RigidBody` (they're ~100k triangles drawn into every shadow map just to shade themselves), split the terrain into tiles so off-screen parts aren't drawn, and smaller sun/moon textures (512 px is plenty at their size on screen)

## io8

- **Wheel:** `collider: ball` custom property on `RobotWheel_RigidBody` (already set in the exported `io8v6.gltf`, a re-export overwrites it). Its hull was a 32-sided polygon, so it bumped over a corner ~100 times a second and io8 felt like he caught on something and jumped ahead. He's locked to his plane, so a sphere rolls like a perfect wheel
- **Headlight** (`RobotHeadlight`, already changed in the exported `io8v6.gltf` to try it, a re-export overwrites it): tilt it up 16° so the beam centre is ~4° below horizontal (it was ~20°, lighting only the road 1.5 m ahead), Power 300 → 750 W plus a `decay: 1` custom property (gentler falloff: not blinding up close, reaches further), Custom Distance 8 → 28 m, spot size 60° → 80°, blend 0.15 → 0.4 (a softer edge)
- **Performance:** `shadowSize: 1024` on `RobotHeadlight` (2048 is more than it needs), and `shadow: 0` on tiny parts (screws, stickers, plates): io8 is 65 parts, each drawn again in every shadow map
- **Damage emitters:** empties with `emit: smoke` (one on the head, one low on the body), parented to the part they move with. Code then: remove the temporary head fallback in `io8.js`

## Props

- **Cardboard:** `collider: cuboid` on `CardboardBox_RigidBody` (cheaper and steadier than a hull, stacks settle sooner)
- **Cardboard decals:** a few versions of the cardboard material with decals baked into the texture (Fragile, arrows, label, plain...). glTF Variants tab (N panel): one variant per design, put its material in the slot and Assign to Variant, then set the slot back to the default. Export with material variants on. Code then: the spawner picks a random variant per box (set the material directly, cloning copies userData as JSON)

## Pickups

- **Speed and Weight:** delete their unused `respawn` custom property (left over from the dropped hand-placed pickups)
- **Health:** replace the temporary `assets/gltf/pickups/Health/Health.gltf` (a copy of Weight with the arrow turned up and a red glow) with a real model, same custom properties: `effect: health`, `amount: 0.25` (share of full health), no `duration`
