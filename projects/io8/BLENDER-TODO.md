# Blender to-do

Custom properties go on the Object tab. After each export, the code side follows.

## io8

- **Emitter empty:** change its `emit` from `damage` to `smoke, sparks` (the code no longer knows `damage`; the exported io8v6.gltf is already patched by hand, so it works until the next export)
- **Muzzle empty:** add an empty called `Muzzle` under `RobotHead_RigidBody`, where the laser bolts leave from, its X axis pointing the way they fly (Z is ignored, they stay on io8's plane). The code no longer falls back to the head without one. The exported io8v6.gltf is already patched by hand with one at the head's origin, unrotated, which is where they came from before, so it works until the next export. Put it at the front of the face, or on a gun if he gets one
- **glass material:** turn on Backface Culling (Material tab → Settings). It's see-through and double-sided, and three.js draws see-through double-sided things twice (back faces, then front) and sets their shader up again for each, every frame. Single-sided, the face and headlight look the same from every side (checked front and back), it's only the extra work that goes (the exported io8v6.gltf is already patched by hand, so it works until the next export)

## Drone (enemy)

The current `assets/gltf/enemies/Drone/Drone.gltf` is a hand-written stand-in (a cube with an eye), exporting over it replaces it. It flies on io8's plane facing him with its **-X side**, so model its front that way. Keep these names, the code looks them up:

- **`Drone_RigidBody`** with `kinematic: 1` (the code flies it, nothing pushes it) and `collider: cuboid` (or `sphere`), at a scale of 1. Children:
- **`Drone_Mesh`**: the body, what it collides with (or add a `Drone_Shape` for a simpler collision shape)
- **`Drone_Eye`**: a separate object with one emissive material (one, or it arrives as several meshes and the code can't find its material). The code makes it glow brighter as it charges up a burst, and blink before it dives, times its emission strength in Blender
- **`Muzzle`**: an empty where its bolts leave from, at the front of the eye or on a gun
- **`Drone_Hurt`**: an empty with `emit: smoke, sparks` and no `rate`, where it smokes and sparks as it's hurt (like io8's)
- Every visible mesh flies off as its own piece when it's shot down (or `debris: whole` on a part to keep it in one piece)

## Mine (prop)

The current `assets/gltf/props/Mine/Mine.gltf` is a hand-written stand-in (a red box with a black fuze), exporting over it replaces it. It lies on the road, so keep its origin at the middle and its bottom flat.

- **`Mine_RigidBody`** with `mass: 3` (blasts and boxes knock it about), `explosive: 1` (anything that moves touching it sets it off) and `collider: cuboid`, at a scale of 1. Children:
- **`Mine_Mesh`**: the body, what it collides with (or a `Mine_Shape`)
- **`Mine_Fuze`** (or whatever it ends up being): looks only, not part of the collision
- **`Mine_Spark`**: an empty at the fuze tip with `emit: sparks`, `rate: 25`, `size: 0.2`, so it sparks all the time. Parent it to the fuze so it flies off with it

## Map (windowsxpmap)

- **SkyPivot:** add `fog: 0`, so the sun and moon aren't faded by the fog (the exported windowsxpmap.gltf is already patched by hand, so it works until the next export)
- **Utility poles and cables:** Geometry Nodes on an empty `UtilityPoles` mesh object. Poles: Mesh Line → Raycast onto `Terrain_RigidBody` → Instance on Points → Realize Instances. Cables: Mesh to Curve → Subdivide → sag `-sag * 4 * t * (1 - t)` → Curve to Mesh (≥ 1.5 cm thick). No `_RigidBody`, `shadow: 0`
- **Grass:** three or four low-poly tufts (three to five tapered blades each, real triangles, no alpha cut-outs) in a `Grass` collection, vertex colour dark at the root to light at the tip. Scatter them with Geometry Nodes on the terrain: Distribute Points on Faces (Poisson Disk) → Instance on Points (Pick Instance, aligned to the normal, random turn and scale), *no* Realize Instances. Keep it off roads, steep slopes and the shore with a weight-painted vertex group, densest near io8's plane and thinning out with distance. No `_RigidBody`, `shadow: 0`. Export with GPU instances on. Code then: wind sway in the vertex shader, check the loader handles GPU instances, measure it with a perf pass
