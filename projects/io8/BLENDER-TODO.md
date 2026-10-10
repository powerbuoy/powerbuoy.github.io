# Blender to-do

Custom properties go on the Object tab. After each export, the code side follows.

## io8

- **Emitter empty:** change its `emit` from `damage` to `smoke, sparks` (the code no longer knows `damage`; the exported io8v6.gltf is already patched by hand, so it works until the next export)
- **Muzzle empty:** add an empty called `Muzzle` under `RobotHead_RigidBody`, where the laser bolts leave from, its X axis pointing the way they fly (Z is ignored, they stay on io8's plane). The code no longer falls back to the head without one. The exported io8v6.gltf is already patched by hand with one at the head's origin, unrotated, which is where they came from before, so it works until the next export. Put it at the front of the face, or on a gun if he gets one
- **glass material:** turn on Backface Culling (Material tab → Settings). It's see-through and double-sided, and three.js draws see-through double-sided things twice (back faces, then front) and sets their shader up again for each, every frame. Single-sided, the face and headlight look the same from every side (checked front and back), it's only the extra work that goes (the exported io8v6.gltf is already patched by hand, so it works until the next export)

## Map (windowsxpmap)

- **SkyPivot:** add `fog: 0`, so the sun and moon aren't faded by the fog (the exported windowsxpmap.gltf is already patched by hand, so it works until the next export)
- **Utility poles and cables:** Geometry Nodes on an empty `UtilityPoles` mesh object. Poles: Mesh Line → Raycast onto `Terrain_RigidBody` → Instance on Points → Realize Instances. Cables: Mesh to Curve → Subdivide → sag `-sag * 4 * t * (1 - t)` → Curve to Mesh (≥ 1.5 cm thick). No `_RigidBody`, `shadow: 0`
- **Clouds:** a few puffy blob shapes in a collection, scattered with Geometry Nodes on a plane a bit bigger than the terrain (Distribute Points on Faces → Instance on Points, random scale/rotation, *no* Realize Instances). Under a `Clouds` empty with `drift` (m/s). Opaque matte white, no emission, `shadow: 0`. Export with GPU instances on. Code then: drift, shrink/grow at the edges
