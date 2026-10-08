# Blender to-do

Custom properties go on the Object tab. After each export, the code side follows.

## Map (windowsxpmap)

- **Utility poles and cables:** Geometry Nodes on an empty `UtilityPoles` mesh object. Poles: Mesh Line → Raycast onto `Terrain_RigidBody` → Instance on Points → Realize Instances. Cables: Mesh to Curve → Subdivide → sag `-sag * 4 * t * (1 - t)` → Curve to Mesh (≥ 1.5 cm thick). No `_RigidBody`, `shadow: 0`
- **Clouds:** a few puffy blob shapes in a collection, scattered with Geometry Nodes on a plane a bit bigger than the terrain (Distribute Points on Faces → Instance on Points, random scale/rotation, *no* Realize Instances). Under a `Clouds` empty with `drift` (m/s). Opaque matte white, no emission, `shadow: 0`. Export with GPU instances on. Code then: drift, shrink/grow at the edges

## Props

- **Cardboard:** `collider: cuboid` on `CardboardBox_RigidBody` (cheaper and steadier than a hull, stacks settle sooner)
- **Cardboard decals:** a few versions of the cardboard material with decals baked into the texture (Fragile, arrows, label, plain...). glTF Variants tab (N panel): one variant per design, put its material in the slot and Assign to Variant, then set the slot back to the default. Export with material variants on. Code then: the spawner picks a random variant per box (set the material directly, cloning copies userData as JSON)

## Pickups

- **Speed:** `amount` 4 → 3 (already changed in the exported `Speed.gltf`, a re-export overwrites it). io8's top speed went from 5 to 7.5 m/s, so 3x (22.5 m/s) is fast enough
- **Speed and Weight:** delete their unused `respawn` custom property (left over from the dropped hand-placed pickups)
- **Health:** replace the temporary `assets/gltf/pickups/Health/Health.gltf` (a copy of Weight with the arrow turned up and a red glow) with a real model, same custom properties: `effect: health`, `amount: 0.25` (share of full health), no `duration`
