# Blender to-do

Custom properties go on the Object tab. After each export, the code side follows.

## Map (windowsxpmap)

- **Water around the map (first):** a last Displace modifier on the terrain pulls its edges down below Z 0: Direction Z, Midlevel 1, Strength ~10-30, Coordinates Object (an empty in the middle, scaled to the map in X/Y and a lot in Z), texture Blend > Spherical with a Ramp that stays white until near the edge (keep the road ends in the white). Then a big plane at the waterline, a plain mesh, not a `_RigidBody` (otherwise props spawn on it and io8 drives on it), `shadow: receive`. Code then: maybe a proper water material, and what happens when io8 drives in
- **Utility poles and cables:** Geometry Nodes on an empty `UtilityPoles` mesh object. Poles: Mesh Line → Raycast onto `Terrain_RigidBody` → Instance on Points → Realize Instances. Cables: Mesh to Curve → Subdivide → sag `-sag * 4 * t * (1 - t)` → Curve to Mesh (≥ 1.5 cm thick). No `_RigidBody`, `shadow: 0`
- **Clouds:** a few puffy blob shapes in a collection, scattered with Geometry Nodes on a plane a bit bigger than the terrain (Distribute Points on Faces → Instance on Points, random scale/rotation, *no* Realize Instances). Under a `Clouds` empty with `drift` (m/s). Opaque matte white, no emission, `shadow: 0`. Export with GPU instances on. Code then: drift, shrink/grow at the edges

## Props

- **Cardboard:** `collider: cuboid` on `CardboardBox_RigidBody` (cheaper and steadier than a hull, stacks settle sooner)
- **Cardboard decals:** a few versions of the cardboard material with decals baked into the texture (Fragile, arrows, label, plain...). glTF Variants tab (N panel): one variant per design, put its material in the slot and Assign to Variant, then set the slot back to the default. Export with material variants on. Code then: the spawner picks a random variant per box (set the material directly, cloning copies userData as JSON)
