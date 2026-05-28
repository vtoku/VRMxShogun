# VRM → Vicon Shogun FBX

Convert a `.vrm` humanoid avatar into a Vicon Shogun–compatible `.fbx`, **entirely in your browser**. Drop a VRM on the page, preview it in 3D, download the FBX. No install, no account, no upload.

**Live:** https://vtoku.github.io/VRM2VICON/

---

## What it does

1. Drag a `.vrm` (or `.glb`) onto the page, or click to pick one.
2. The avatar renders in a 3D preview with its metadata (title, author, license, bone/vertex counts).
3. Click **Download FBX** to get a `.fbx` you can import into Shogun as a retarget target.

The FBX contains the **skeleton, skinned mesh, and skin weights**. The bone **hierarchy and names are preserved exactly from the VRM** — bones are *not* renamed, because renaming breaks downstream streaming retargeting (e.g. Unity/Warudo). Only the **bind-pose orientation** is **rebaked to world-aligned** (the Maya joint convention Shogun expects: every joint has identity rotation in bind pose, differing only by translation).

## How it works

Pure client-side pipeline (see [SPEC.md](SPEC.md) for the full design):

```
VRM → manual GLB parse (humanoid + meta)        src/vrm/
    → three GLTFLoader (SkinnedMesh + Skeleton)
    → rebake bind pose to world-aligned joints    src/convert/build.ts
      (original bone names + hierarchy preserved)
    → ASCII FBX 7.4 writer (LimbNodes + skin       src/fbx/asciiFbx.ts
      clusters + BindPose) → download
```

### FBX exporter choice

This project ships a **hand-rolled ASCII FBX 7.4 writer** ([src/fbx/asciiFbx.ts](src/fbx/asciiFbx.ts)) rather than wrapping `three-fbx-exporter`. The deciding factor is the bone rebake: Shogun needs every joint at identity rotation / `PreRotation` in bind pose, and a hand-rolled writer gives direct control over those fields and over the cluster `Transform`/`TransformLink` matrices and `BindPose` that must match exactly. ASCII (not binary) is intentional — it's debuggable and Shogun-accepted.

### Axis & scale

The FBX is written **Y-up** (`UpAxis=Y`, matching glTF, no geometry rotation) and in **centimeters** with `UnitScaleFactor=1` — geometry is converted meters→cm so the avatar imports at correct human size regardless of whether the importer applies `UnitScaleFactor`.

If Shogun imports the character at the wrong **scale**, adjust `METERS_TO_CM` in [src/convert/build.ts](src/convert/build.ts). If it imports **rotated 90°**, the fallback is to bake an axis rotation into the export (see SPEC.md "Coordinate system reference"). VRM 0.x avatars are rotated 180° about Y on load to match VRM 1.0's forward direction.

## Verification status

- ✅ TypeScript type-check + production build (`npm run build`).
- ✅ FBX output round-trips through three's `FBXLoader` into the correct bones + skinned mesh (`npm run smoke`).
- ⏳ **Not yet verified in Vicon Shogun or Blender** — those require the respective applications and a real VRM. The two must-pass acceptance criteria (clean Shogun import with no bind-pose explosion; world-aligned bones in Blender) are pending hardware/software access. See the checklist in [SPEC.md](SPEC.md#acceptance-criteria).

If you test in Shogun/Blender, please open an issue noting the version and result.

## Development

```bash
npm install
npm run dev        # dev server
npm run build      # type-check + build to dist/
npm run preview    # serve the built site (test the /VRM2VICON/ base path here)
npm run smoke      # FBX writer structural round-trip test
```

## Deployment

Hosted on GitHub Pages via the workflow in [.github/workflows/deploy.yml](.github/workflows/deploy.yml): every push to `main` builds and publishes `dist/`. Pages source is set to **GitHub Actions**. Vite's `base` is `/VRM2VICON/` so assets resolve under the project path; a `.nojekyll` file keeps Pages from rewriting asset paths.

## Not in v1

Textures/MToon shader fidelity, blendshapes, spring bones, lookAt, and animation. The FBX is a static T-pose target rig; mocap retargeting happens in Shogun. See SPEC.md stretch goals.

## License

[MIT](LICENSE). Bundled sample assets, if any, must be CC0 or equivalent.

## Trademarks & disclaimer

"Vicon" and "Shogun" are trademarks of Vicon Motion Systems Ltd. "VRM" is a trademark of the VRM Consortium. This is an independent, unofficial, fan-made tool and is **not** affiliated with, endorsed by, or sponsored by Vicon Motion Systems Ltd or the VRM Consortium. All trademarks are the property of their respective owners and are used here only to describe interoperability.
