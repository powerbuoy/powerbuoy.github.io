---
name: perf-pass
description: Run a performance and cleanup pass on io8 - measure first, find what allocates, what costs GPU time and which shaders compile late, fix root causes, then prove the result against the previous build with deterministic old-vs-new benchmarks. Use when the user asks for a performance pass, a cleanup run, to check whether io8 got slower, or to measure a change's cost.
---

# io8 performance and cleanup pass

The pass in commit 88fca3e (October 2026) followed these steps, and so should the next one. Measure before touching anything, fix the root cause instead of adding a workaround, and prove the result against the previous build.

## Ground rules

- **Blender first.** If something can be fixed in the model (double-sided materials, missing empties, shadow flags), the user fixes it in Blender. Patching the exported `.gltf` by hand so the build works is fine, but every such patch goes on `BLENDER-TODO.md`. Never add code workarounds for model problems.
- **Physics must not change by accident.** The user has tuned the feel. A refactor of anything in a physics step has to leave io8's path identical (see the trajectory check below).
- **Leave it uncommitted.** Run `npm run build` and leave the result for the user to try and review. Commit only when they ask, with a message that leads with the measured numbers.
- **Report honestly.** Say what didn't improve too. On the user's Mac the GPU (~8.5 ms a frame at 1600×900) is the limit, so CPU work alone doesn't change the frame rate.

## Setup

The scripts need Playwright and two local servers.

1. Copy `scripts/` into the session scratchpad and run `npm init -y && npm i playwright` there. Never install it in the project. Chromium is already cached in `~/Library/Caches/ms-playwright/`.
2. Serve the repo root (`~/Sites/powerbuoy.github.io`) on port 8765, if nothing is listening there already: `python3 -m http.server 8765`.
3. Build the previous version to compare against:
   ```sh
   git -C ~/Sites/powerbuoy.github.io worktree add --detach <scratchpad>/base HEAD
   ln -s ~/Sites/powerbuoy.github.io/projects/io8/node_modules <scratchpad>/base/projects/io8/node_modules
   (cd <scratchpad>/base/projects/io8 && npm run build)
   python3 -m http.server 8766 --directory <scratchpad>/base
   ```
4. Run `npm run build` in the project before every measurement. The scripts measure `dist/`, except `alloc.mjs`.

The URLs:
- New build: `http://localhost:8765/projects/io8/dist/`
- Old build: `http://localhost:8766/projects/io8/dist/`
- Unminified source: `http://localhost:8765/projects/io8/`

Afterwards, run `git worktree remove --force <scratchpad>/base` and stop the 8766 server.

## The steps

1. **Baseline.** Run `node bench.mjs <old> <new>` with old and new pointing at the same build. This gives the baseline and the run-to-run noise. A single short run of one build against itself can swing ±30%, so never quote fewer than 3 runs of 600 frames (the defaults).
2. **Find the costs**, in parallel with a code review:
   - `node alloc.mjs <source url>`: what allocates, by call site and call stack.
   - `node gpu.mjs <new>`: GPU cost of the shadow maps, each post-processing pass, io8, each part of the map and the double-sided materials, plus the biggest meshes.
   - `node shaders.mjs <new>`: shaders compiled after warm-up (hitches), and materials three.js sets up again every frame.
   - A read-only review subagent over everything changed since the last pass (`git log --grep=performance`). Ask it for per-frame and per-physics-step allocations (physics runs at 240 Hz), wasted per-frame work, dead code, duplicated logic and stale comments. **Verify each claim before acting on it.** A reviewer once said the model had a `Muzzle` empty when it didn't, and removing the "dead" fallback broke shooting.
3. **Fix**, root causes only. Typical wins:
   - Rapier getters with a target (`body.translation(v)`, `rotation(q)`, `linvel(v)`, `angvel(v)`, `worldCom(v)`); without one they allocate on every call.
   - Module-level scratch vectors.
   - Plain loops instead of `forEach`/`some` with closures in hot paths.
   - Pools made up front.
   - Work done once instead of every frame.
4. **Prove it.** Run `node bench.mjs <old> <new>` (bare map) and check the trajectory lines, then `shaders.mjs` again. Play-test, take screenshots of anything visual you touched, and log the `audio.playAt` calls for anything sound-related.
5. **Second opinion.** Run `/code-review` and a targeted review subagent in parallel, on Opus. Tell the subagent what's already verified so it looks where tests didn't. Check every finding, then present one list sorted into real, cosmetic and wrong before fixing anything.

## Traps (all hit for real)

- **Runs must be deterministic or the numbers lie.** The scripts seed `Math.random` and step `app.step(1/60)` by hand from the paused first frame, never in real time. Props still differ between builds, because the spawner's layout isn't reproducible, and io8 getting stuck in a box pile in one build doubles its physics time. That's why `bench.mjs` removes props and pickups by default. Quote `--full` numbers only if both builds ended in the same place.
- **Rapier impulses change velocity immediately.** Positions only move on `world.step()`, but `applyImpulse` and `applyTorqueImpulse` change `linvel`/`angvel` straight away. Reading every velocity once at the top of a step changed io8's physics. Read velocities again after any push that comes before their use.
- **The trajectory check is the physics regression test.** With props and pickups off, both builds must end with the same camera position and health to 4 decimals. If only combat differs, try `--nofire`: shot paths depend on the muzzle. Death differs between runs even of the same build. Impact sounds have a cooldown on the wall clock (`impacts.js`, `performance.now()`) that decides whether a random variation is picked, and that shifts every `Math.random` after it, debris included. Compare only up to combat.
- **Transparent and double-sided materials cost CPU every frame.** three.js draws them twice (back faces, then front) and sets their shader up again each time. `shaders.mjs` shows them flipping `__version`. Fix it in Blender with Backface Culling, unless the mesh needs both sides (the thruster flames are crossed planes).
- **Warm-up stand-ins have to be in view.** three only compiles what isn't culled, and the camera views turn.
- **Most of what's left in `alloc.mjs` is three.js** uploading uniforms per draw call (`setValueM4` and friends), which only fewer draw calls can reduce.
- **Rapier getters allocate a little inside, even with a target.** wasm-bindgen hands back the result through a new typed-array view each call, and the profiler counts it under the caller (for example `remember` in `physics.js`). A target vector removes our share. The rest only shrinks with fewer getter calls.
- **The thruster flames show up in `shaders.mjs`** as set up again while thrusting. They're see-through crossed planes and need both sides, so that's expected.
- **`performance.now()` resolution is 0.1 ms** here, so trust means over hundreds of frames, not single frames.
