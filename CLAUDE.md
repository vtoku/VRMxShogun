# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**[SPEC.md](SPEC.md) is the authoritative product + architecture spec.** Read it first. This file is the operational quick-reference; when the two disagree, SPEC.md wins.

## What this is

A **client-side web app** that converts a **VRM humanoid avatar** into a single **Vicon Shogun–compatible `.fbx`** (a target rig for Shogun's retargeter). Drop a `.vrm` on the page → preview in 3D → download the FBX.

Hosted on **GitHub Pages** at `https://vtoku.github.io/VRM2VICON/` (repo: `vtoku/VRM2VICON`, an org repo). Pages is **static hosting — there is no backend**. VRM parse, bone rebake, FBX generation, and download all run **in the browser**. Never add a server-side step; if something can't be done client-side, surface it as a limitation.

**v1 scope is FBX only.** `.vsk`/`.vst` Vicon skeleton XML, blendshapes, spring bones, MToon fidelity, and animation are explicitly out of scope for v1 (see SPEC.md non-goals / stretch goals).

## Stack

- **Vite** + **TypeScript** — static build to `dist/`, deploys cleanly to Pages.
- **Three.js** (pin ~`0.160.x`+). VRM is glTF 2.0 + extensions: load the mesh/skeleton with `GLTFLoader.parse()` (it ignores VRM extensions but builds the `SkinnedMesh` + `Skeleton` correctly), and parse the VRM `humanoid`/`meta` extensions **manually** from the GLB JSON chunk. `@pixiv/three-vrm` is *not* a v1 dependency (it's a stretch goal for spring-bone-aware preview).

## Commands

```bash
npm install
npm run dev        # Vite dev server
npm run build      # type-check + production build to dist/
npm run preview    # serve built dist/ — ALWAYS test the Pages base path here, not just dev
```

No tests/linter configured yet. When adding them, document the single-test invocation here.

## Conversion pipeline

```
VRM file (drag/drop, whole page)
  → GLB parse (manual): JSON chunk → VRM humanoid bones + meta   (src/vrm/glb.ts, humanoid.ts)
  → GLTFLoader.parse(): SkinnedMesh + Skeleton                   (src/vrm/skinnedMesh.ts)
  → rename bones → Shogun-friendly names (Hips, Spine, LeftUpperArm…)
  → BONE REBAKE: world-align every joint (identity rotation, Maya convention)
  → ASCII FBX writer: LimbNode skeleton + skinned mesh + skin clusters + BindPose
  → download .fbx
```

Keep parse → rename → rebake output-agnostic from the FBX writer. The rebake produces one normalized skeleton; the writer is a pure consumer of it.

## Domain knowledge that is easy to get wrong

- **The bone rebake is the riskiest correctness work**, independent of any export library. Shogun expects the Maya joint convention: every joint has **identity rotation/PreRotation in bind pose**, differing only by `Lcl Translation` (world-space offset from parent). VRM rigs carry local rotations in the T-pose, so you must: compute each bone's world transform, discard rotation, set local translation = `worldPos_self − worldPos_parent`, zero all rotations, then recompute skin-cluster matrices (`TransformLink` = bone world bind, `Transform` = its inverse). Vertices/weights are unchanged. See SPEC.md §"Bone orientation rebake". Verify in Blender: bones must be world-axis aligned, not pointing down their own length.

- **FBX export is hard — Three.js has no core FBX exporter** (`FBXLoader` is import-only). Plan: first try `three-fbx-exporter` (yomotsu, MIT); if it won't let you control bone PreRotation/`Lcl Rotation`, fall back to a hand-rolled **ASCII** FBX 7.5.0 writer (never binary — ASCII is debuggable and Shogun-accepted). The rebake work carries over either way.

- **BindPose must exactly match cluster `TransformLink`** matrices. Mismatch = "character explodes on import" — the #1 failure mode.

- **VRM 0.x vs 1.0 differ** in extension key (`VRM` vs `VRMC_vrm`), humanBones shape (array vs object), meta field names, and forward axis (180° apart). Detect the version and normalize both into one internal `{ version, meta, humanoidBones }` shape.

- **Axis/units:** declare `UpAxis=Y`, `UnitScaleFactor=100` (cm) in FBX `GlobalSettings` and do **not** rotate geometry — let Shogun's import dialog convert to the project's axis/units. Centralize any axis/unit constants; never scatter them across the writer. Fallback documented in SPEC.md if Shogun imports rotated 90°.

- **Bone names drive Shogun retargeting.** Rename to the Shogun schema (`Hips`, `Spine`, `LeftUpperArm`, …) before export; keep original names only for the metadata panel display.

## GitHub Pages deployment

- **`base: '/VRM2VICON/'` in `vite.config.ts`** — Pages serves org/project sites under `/<repo>/`; with default `base: '/'` all assets 404 in production but work in `dev`. Validate with `npm run preview`.
- Ship a **`.nojekyll`** file (in `public/`) so Pages doesn't strip underscore-prefixed asset paths.
- Deploy via a **GitHub Actions workflow** (build + `actions/deploy-pages`), Pages source = "GitHub Actions". Don't hand-manage a `gh-pages` branch.

## Repo note

`VRM2VICON/` has its **own** git repo (origin `vtoku/VRM2VICON`). It sits inside an unrelated local catch-all `Claude/` git tree (camboxd, WarudoDiscordApp) that has no remote — ignore that outer repo; all work and commits here target this repo only.
