# VRM → Vicon Shogun FBX Converter

A static, browser-based tool that takes a `.vrm` humanoid avatar and produces a Vicon Shogun–compatible `.fbx`. Drop a VRM on the page, preview it in 3D, download the FBX.

Hosted as a single page on GitHub Pages so it can be shared as a URL — no install, no account, no server.

---

## Revision note (2026-05-28) — bone renaming removed

This spec originally called for renaming humanoid bones to a Shogun-friendly schema (`Hips`, `Spine`, `LeftUpperArm`, …). **That was reversed after real-world testing:** renaming bones broke downstream **streaming retargeting to Unity/Warudo**, which keys off the VRM's original bone names. The implemented behavior is:

- **Bone names and hierarchy: preserved exactly from the source VRM. Never renamed or reparented.**
- **Bind-pose orientation: still rebaked to world-aligned (the Maya joint convention Shogun expects).** This is the one transform applied; it changes orientation only, not names or parenting.

Wherever the sections below say to rename bones to a Shogun schema, treat that as superseded by this note.

---

## Why this exists

Vicon Shogun has no built-in VRM importer and no public plugin SDK for adding one. Shogun reads FBX cleanly. VRM is glTF 2.0 with a humanoid extension. So the workable path is: convert VRM → FBX in the browser, with the conversion tuned to what Shogun specifically expects (axis settings, bind pose, LimbNode hierarchy, skin clusters).

Today people round-trip through Blender or Unity manually. This tool collapses that into a drag-and-drop.

---

## Goals

- Run entirely in the browser. No backend, no upload. GitHub Pages–hostable as a static site.
- Accept VRM 0.x and VRM 1.0.
- Produce a single `.fbx` that Shogun (Live and Post) imports without manual fixing of axes, bone hierarchy, or bind pose.
- Live 3D preview so the user confirms they loaded the right file before exporting.
- Real-tool aesthetic: Linear / Stripe / Raycast register.
- In-UI honesty about what's preserved (skeleton, skinned mesh) and what's not (mtoon shader fidelity, spring bones, blendshapes in v1).

## Non-goals (v1)

- Spring bones, lookAt constraints, MToon shader translation beyond a basic PBR fallback.
- Animation export. T-pose only.
- Blendshape export. Tracked as a stretch goal.
- Mocap retargeting in-browser. The FBX is a *target rig* for Shogun's retargeter; the retarget happens in Shogun.
- Server-side anything. No telemetry, no analytics, no uploads.

---

## Target user

A mocap tech or VTuber rigger with a `.vrm` who wants to drive it with Shogun mocap. Comfortable with Shogun's import dialog. Not necessarily a developer.

### Concrete workflow

1. Open the GitHub Pages URL.
2. Drag a `.vrm` onto the page.
3. See the avatar render in a 3D preview, with metadata (title, author, bone count, vertex count).
4. Click **Download FBX**.
5. `character_name.fbx` saves locally.
6. In Shogun: File → Import → pick the FBX. The skeleton and mesh appear in the expected orientation, ready to use as a retarget target.

---

## Tech stack & constraints

- **Pure static site.** Single `index.html` is acceptable; small `src/` split is also fine. Build step optional.
- **JavaScript (ESM).** TypeScript fine if the implementer prefers, must build to static.
- **Three.js** (pin a version, suggest `0.160.x` or newer) for GLB parsing convenience and preview.
- **FBX exporter:** start by evaluating `three-fbx-exporter` (MIT, by yomotsu). If it produces FBX that Shogun accepts after parameter tuning, use it. If not, fork it or write a minimal ASCII FBX 7.5.0 writer focused on the LimbNode + skinned-mesh subset Shogun needs. Document the decision in the README.
- **No frameworks required.** Vanilla DOM is enough. React/Svelte fine if preferred.
- **No backend.** No telemetry. No third-party trackers.

### Deployment

- Static site at repo root (or `dist/` after build).
- `.nojekyll` file so GitHub Pages doesn't munge paths.
- GitHub Pages source documented in `README.md`.

---

## Suggested file structure

```
vrm-to-shogun/
├── index.html
├── src/
│   ├── main.js
│   ├── vrm/
│   │   ├── glb.js          # GLB container parsing
│   │   ├── humanoid.js     # VRM 0.x and 1.0 humanoid extraction
│   │   └── skinnedMesh.js  # Build a three.js SkinnedMesh from VRM
│   ├── fbx/
│   │   ├── exporter.js     # Wrap chosen FBX exporter, configure for Shogun
│   │   └── shogunPreset.js # Axis settings, units, post-processing
│   ├── preview/
│   │   └── scene.js
│   └── ui/
│       ├── dropzone.js
│       ├── metadataPanel.js
│       └── downloadButton.js
├── styles.css
├── public/
│   └── sample.vrm          # Optional CC0 test fixture
├── .nojekyll
├── README.md
├── LICENSE
└── CLAUDE.md               # Optional notes for future agentic work
```

---

## UI direction

Register: Linear, Stripe, Raycast, GitHub. Not generic SaaS-AI.

Do:
- Restrained palette. One accent (desaturated blue or warm orange). Generous neutrals.
- System font stack or Inter. Tight letter-spacing on headings.
- Subtle 1px borders, low-contrast. No shadows on everything.
- 4–8px corners. Not `rounded-3xl`.
- Plain-English copy. No "✨ AI-powered" energy.

Don't:
- Purple/pink gradients, glassmorphism, decorative emoji.
- Centered hero with three feature cards.

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ VRM → Shogun FBX                                   v0.1 · Source │
├─────────────────────────────────────────────────────────────────┤
│  Empty state:                                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │           Drop a .vrm file here, or click to pick          │ │
│  │   Runs entirely in your browser. Nothing is uploaded.      │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

Loaded state:
┌─────────────────────────────────────────────────────────────────┐
│ VRM → Shogun FBX                                   v0.1 · Source │
├──────────────────────────────────┬──────────────────────────────┤
│                                  │ character_name.vrm           │
│                                  │ 4.2 MB                       │
│      [ 3D preview viewport ]     │                              │
│      (orbit / pan / zoom)        │ Title    My Character        │
│                                  │ Author   Jane Doe            │
│                                  │ License  CC BY 4.0           │
│                                  │ Version  VRM 1.0             │
│                                  │                              │
│                                  │ Skeleton    54 bones         │
│                                  │ Humanoid    52/54 mapped     │
│                                  │ Meshes      3 (47k verts)    │
│                                  │                              │
│                                  │ ┌──────────────────────────┐ │
│                                  │ │     Download FBX         │ │
│                                  │ └──────────────────────────┘ │
│                                  │                              │
│                                  │  Load a different file       │
└──────────────────────────────────┴──────────────────────────────┘
```

---

## Functional requirements

### 1. File loading

- Accept `.vrm` and `.glb`.
- Drag-and-drop on the whole page plus a hidden `<input type="file">` triggered by clicking the dropzone.
- Reject non-GLB with an inline error.
- Read as `ArrayBuffer`.

### 2. GLB parsing

```js
export function parseGLB(arrayBuffer) {
  const dv = new DataView(arrayBuffer);
  const magic = dv.getUint32(0, true);          // 0x46546C67 'glTF'
  if (magic !== 0x46546C67) throw new Error('Not a GLB file');
  const totalLength = dv.getUint32(8, true);

  const jsonChunkLength = dv.getUint32(12, true);
  const jsonBytes = new Uint8Array(arrayBuffer, 20, jsonChunkLength);
  const json = JSON.parse(new TextDecoder().decode(jsonBytes));

  let bin = null;
  const binChunkStart = 20 + jsonChunkLength;
  if (binChunkStart < totalLength) {
    const binChunkLength = dv.getUint32(binChunkStart, true);
    bin = new Uint8Array(arrayBuffer, binChunkStart + 8, binChunkLength);
  }
  return { json, bin };
}
```

Use this for metadata extraction. For mesh/skin data, prefer three.js `GLTFLoader.parse(arrayBuffer, '', onLoad, onError)` — it gives you a fully constructed `Group` containing `SkinnedMesh` objects with the skeleton already built. That's the input the FBX exporter wants.

### 3. VRM humanoid extraction

Support both versions.

- **VRM 1.0**: `json.extensions.VRMC_vrm.humanoid.humanBones` is `{ hips: { node: N }, ... }`. Metadata under `extensions.VRMC_vrm.meta`.
- **VRM 0.x**: `json.extensions.VRM.humanoid.humanBones` is `[{ bone: 'hips', node: N, useDefaultValues: true }, ...]`. Metadata under `extensions.VRM.meta` with renamed fields (`title`, `author`, `licenseName`, …).

Normalize to:

```js
{
  version: '1.0' | '0.x',
  meta: { title, author, license, version, contactInformation },
  humanoidBones: {
    hips: { nodeIndex, nodeName },
    spine: { nodeIndex, nodeName },
    // ... up to 55 entries
  }
}
```

Full humanoid bone list (VRM 1.0): `hips, spine, chest, upperChest, neck, head, leftEye, rightEye, jaw, leftShoulder, leftUpperArm, leftLowerArm, leftHand, rightShoulder, rightUpperArm, rightLowerArm, rightHand, leftUpperLeg, leftLowerLeg, leftFoot, leftToes, rightUpperLeg, rightLowerLeg, rightFoot, rightToes`, plus all fingers (`leftThumbMetacarpal/Proximal/Distal`, same for index/middle/ring/little, both hands).

### 4. Three.js scene construction

- Use `GLTFLoader` to parse the VRM as a glTF (it'll ignore VRM-specific extensions but the mesh, skeleton, and skinning come through fine).
- The resulting `Group` contains one or more `SkinnedMesh`es sharing a `Skeleton`.
- Apply humanoid bone-name normalization to `bone.name` before export: map VRM node names (often Japanese, like `J_Bip_C_Hips`) to Shogun-friendly names (`Hips`, `Spine`, `LeftUpperArm`, …). This is critical — Shogun retargeting relies on bone names matching its expected schema. Use the `humanoidBones` map to rename in place.
- Keep an unrenamed copy if you want to display original names in the metadata panel.

### 5. 3D preview

- Perspective camera, OrbitControls.
- Neutral background (`#0e1014` dark, or `#f7f7f8` light — match theme).
- Subtle grid floor.
- Key directional light + low ambient.
- Frame the camera to the model's bounding box on load.
- Dispose Three.js resources when a new file is loaded.

### 6. Metadata panel

Display in order:
- Filename, size
- Title, author, license, VRM version
- Bone count (total nodes vs. humanoid-mapped)
- Mesh primitive count + total vertex count
- A warning row if required humanoid bones are missing

### 7. FBX export — the main event

The output must be an FBX 7.x file that Shogun imports cleanly with:

- **Skeleton:** every humanoid bone as a `Model::LimbNode`, parented per the VRM hierarchy starting from `Hips` as the root. Names match the Shogun-friendly naming applied in step 4.
- **Bone orientation (critical):** Shogun expects all bones to be oriented to Maya's world space. Every `LimbNode`'s `Lcl Rotation` and `PreRotation` must be `0,0,0` in bind pose. Bones differ only in `Lcl Translation` — they sit at world-aligned offsets from their parent with identity orientation. See "Bone orientation rebake" below; this is *not* a flag you flip, it's a transformation you apply to the skeleton before writing.
- **Skinned mesh:** vertices, normals, UVs, polygon indices, plus a `Deformer::Skin` with one `SubDeformer::Cluster` per bone. Each cluster carries the vertex indices it affects, the weights, the bone's world-space bind matrix (`TransformLink`), and the mesh-to-bone inverse bind matrix (`Transform`). These matrices reflect the *rebaked* (world-aligned) skeleton, not the original VRM one.
- **Bind pose:** a `Pose::BindPose` node listing the mesh model and every bone with their world bind matrices, exactly matching the cluster `TransformLink` values. Mismatches here are the #1 cause of "character explodes on import."
- **Axis settings in `GlobalSettings`:** declare the source as Y-up explicitly (Maya convention). Set `UnitScaleFactor` to match Maya's default (`1` with `OriginalUnitScaleFactor=1` for cm). Shogun's import handles the conversion to project axes/units on the way in.
- **Materials:** one `Material` per glTF material. Translate MToon → Phong with `DiffuseColor` taken from MToon's `_Color` / `baseColorFactor`. Texture references should embed via FBX `Video` nodes with base64 `Content`, or omit textures in v1 and surface a warning ("Textures omitted, mesh imports untextured. Re-link in Shogun if needed.").

#### Bone orientation rebake (Maya world-space convention)

Shogun expects the Maya joint convention: every joint in bind pose has zero rotation, with bone axes inherited from world space. VRM bones generally do *not* meet this — fingers and limbs often carry local rotations in the bind pose to express the T-pose shape. The exporter must rebake the skeleton before writing:

1. Walk the original VRM skeleton and compute each bone's world-space transform in bind pose (compose parent matrices).
2. Discard the rotation component of every world transform. Keep only world position.
3. For each bone, the new local translation is `worldPos_self - worldPos_parent` expressed in world axes (no rotation transform applied, since parent is now identity-rotated).
4. Set every bone's local rotation and pre-rotation to identity.
5. Recompute skin cluster matrices against the rebaked skeleton:
   - `TransformLink` for cluster *b* = identity rotation + translation `worldPos_b` (world bind of the rebaked bone).
   - `Transform` for cluster *b* = inverse of `TransformLink` composed with the mesh's world bind (typically identity if the mesh is at world origin).
6. Vertex positions, normals, and skin weights/indices stay as-is — they were already authored in the mesh's world space; only the *skeleton's* representation changes. Visually the bound mesh is unchanged.

Verify with a Blender open of the exported FBX: every bone should display as axis-aligned to world, not aligned down its own length. If bones point in their own local-axis direction in Blender's armature view, the rebake didn't take.

#### Implementation approach

Two paths. Try them in order:

1. **`three-fbx-exporter` (yomotsu, MIT).** Build the three.js `SkinnedMesh` from the GLB, run the exporter, set Shogun-targeting parameters (axis = Y-up, units = cm). Smoke-test against Shogun. If it works, ship.
2. **Hand-rolled minimal ASCII FBX 7.5.0 writer.** Required modules only: `FBXHeaderExtension`, `GlobalSettings`, `Definitions`, `Objects` (Model::Null root, Model::LimbNode×N, Geometry, Model::Mesh, Material, Deformer::Skin, SubDeformer::Cluster×N, Pose::BindPose), `Connections`. ASCII format — readable, debuggable, accepted by Shogun.

The implementer should not write a binary FBX. ASCII is sufficient and 10× easier to debug when Shogun complains.

#### ASCII FBX skeleton, for orientation

This is what one bone and one cluster look like. Treat as a sketch, not a finished template — verify field versions against current FBX format docs.

```
Model: 1100, "Model::Hips", "LimbNode" {
    Version: 232
    Properties70:  {
        P: "PreRotation", "Vector3D", "Vector", "", 0,0,0          ; identity — Maya world convention
        P: "RotationActive", "bool", "", "",1
        P: "InheritType", "enum", "", "",1
        P: "ScalingMax", "Vector3D", "Vector", "",0,0,0
        P: "DefaultAttributeIndex", "int", "Integer", "",0
        P: "Lcl Translation", "Lcl Translation", "", "A",0,103.5,0  ; world-delta from parent
        P: "Lcl Rotation", "Lcl Rotation", "", "A",0,0,0            ; identity — Maya world convention
        P: "Lcl Scaling", "Lcl Scaling", "", "A",1,1,1
    }
    Shading: T
    Culling: "CullingOff"
}

Deformer: 4101, "SubDeformer::Cluster Hips", "Cluster" {
    Version: 100
    UserData: "", ""
    Indexes: *K { a: 12,45,78,... }
    Weights: *K { a: 0.34,0.91,0.22,... }
    Transform: *16 { a: ... }       ; mesh-to-bone inverse bind, column-major
    TransformLink: *16 { a: ... }   ; bone world bind, column-major
}
```

#### Connections graph

For each bone: `C: "OO", boneId, parentBoneId` (or `0` if root parent is the scene).
Mesh: `C: "OO", geometryId, meshModelId`, then `C: "OO", meshModelId, 0`.
Skin: `C: "OO", skinId, geometryId`.
Each cluster: `C: "OO", clusterId, skinId`, then `C: "OO", boneId, clusterId`.
Pose: `C: "OO", poseId, 0`.
Materials: `C: "OO", materialId, meshModelId`.

### 8. Download

- Trigger via `Blob` + temporary `<a download>` click.
- Filename: `{sanitized-title-or-source-filename}.fbx`.
- Show a transient "Building FBX…" state. Most VRMs export in under a second; large ones (50k+ verts) might take 1–3.

---

## Coordinate system reference

| | VRM (glTF) | Shogun import expectation |
|---|---|---|
| Up axis | +Y | Configurable, but FBX `UpAxis=Y` is handled fine |
| Handedness | right | right |
| Units | meters | Shogun projects vary; cm is the safest FBX default |

**Strong suggestion:** declare `UpAxis=Y`, `UnitScaleFactor=100` (cm) in FBX `GlobalSettings` and do *not* rotate geometry at export. Shogun's import dialog converts to project axes on the way in. If the user's Shogun project is Z-up, the import handles it.

Fallback: if Shogun consistently imports rotated 90° around X, switch to baking the rotation into root translations and zero out FBX axis fields. Document whichever works in the README.

---

## In-app honesty notes (show inline near the download button)

- "FBX contains skeleton, mesh, and skin weights. MToon shaders are converted to a basic material — re-link textures in Shogun if needed."
- "Blendshapes, spring bones, and lookAt are not included in v1."
- "Everything runs in your browser. No file is uploaded."
- "If Shogun imports the character at the wrong scale or rotation, see the project README for the axis/unit toggle."

---

## Acceptance criteria

Manual test checklist for v1:

- [ ] Loads a VRM 1.0 file without errors; preview renders in T-pose.
- [ ] Loads a VRM 0.x file without errors; preview renders in T-pose.
- [ ] Rejects a non-GLB file with an inline error.
- [ ] Metadata panel populates with title, author, license, version, bone count, vertex count.
- [ ] Flags missing required humanoid bones.
- [ ] **Download FBX produces a file that opens in Blender, shows the skinned mesh in T-pose with the correct skeleton hierarchy and bone names.**
- [ ] **The FBX opens in Vicon Shogun without errors, with skeleton named in Shogun-friendly form (`Hips`, `Spine`, `LeftUpperArm`, …), mesh present, no bind-pose explosion.**
- [ ] Bones are recognized as `LimbNode` (not `Null`) in Shogun's subject builder so they're usable as a retarget target.
- [ ] **Every bone is world-axis aligned in bind pose (Maya convention).** Verify in Blender: armature view shows all bones aligned to world X/Y/Z, not pointing down their own length. In Maya: every joint shows `rotate = 0,0,0` and `jointOrient = 0,0,0` at bind.
- [ ] Loading a second file disposes the first three.js scene cleanly.
- [ ] Works offline after first load (no required runtime network calls).
- [ ] Deploys to GitHub Pages and works at the deployed URL.

The two bolded criteria are the must-pass. The Blender check is a cheap proxy for "the FBX is structurally valid"; the Shogun check is what we actually ship for.

---

## Testing strategy

Browser-side FBX export for a specific DCC is an iterate-against-the-target problem. Plan for it:

1. **Establish a known-good FBX baseline.** Take a VRM, run it through Blender (VRM addon import → in pose mode, apply rest pose so bones are world-aligned → FBX export with `Add Leaf Bones=False`, `Apply Scalings=FBX Units Scale`). Import that into Shogun. Confirm it works. Save the working FBX as a reference fixture (`test/fixtures/baseline.fbx`). The "apply rest pose so bones are world-aligned" step is the Blender equivalent of the bone orientation rebake — your exporter does it programmatically.
2. **Diff your exporter's output against the baseline.** Both are ASCII (run the baseline through an ASCII FBX dump if Blender exported binary). The diff will surface specific field-version mismatches, missing properties, axis flips.
3. **Test fixtures.** Commit at least one CC0 VRM in `test/fixtures/` for repeatable testing. The VRoid sample avatars are appropriate.
4. **Smoke-test outside Shogun too.** Open the output in Blender, Autodesk FBX Review, and Three.js's own `FBXLoader`. Each catches different classes of bugs.
5. **Track Shogun versions tested in the README.** "Verified against Shogun Live 1.10, Shogun Post 1.8" or whatever.

---

## Suggested implementation order

PR-sized chunks. Each leaves the app working.

1. **Scaffolding.** `index.html`, `src/main.js`, CSS, `.nojekyll`, README, LICENSE. Empty dropzone.
2. **File loading + GLB parsing.** Drop a file, log JSON. Toast feedback only.
3. **Three.js preview.** GLTFLoader, OrbitControls. Replace dropzone with split layout when a file is loaded.
4. **VRM humanoid extraction + metadata panel.** Populate the right column.
5. **Bone renaming.** Walk the `Skeleton`, rename `Bone` objects to Shogun-friendly names using the humanoid map.
6. **Bone orientation rebake.** Implement the world-aligned-joint transformation against the three.js `Skeleton` before any FBX export work. Verify visually in the preview by drawing bone axes — every bone should show world-aligned axes, not local. This step is independent of the exporter choice and is the riskiest correctness work in the project.
7. **FBX export — first cut with `three-fbx-exporter`.** Wire it up using the rebaked skeleton. Download a file. Open it in Blender. Check armature view shows world-aligned bones.
8. **Shogun smoke test + iteration.** Open in Shogun. Note every failure. Adjust axis settings, units, bone naming, cluster matrices until it imports clean. This step is open-ended — budget for it.
9. **Materials pass.** MToon → Phong/PBR fallback. Texture embedding or "textures omitted" warning.
10. **In-app honesty notes, error states, polish pass.**
11. **GitHub Pages deploy.** Document steps in `README.md`.

If step 7 fails (the exporter produces FBX Shogun won't accept and the fixes are unbounded — most likely because the exporter resists letting you control bone PreRotation/Lcl Rotation directly), switch to a hand-rolled ASCII writer. Treat it as a fork point, not a failure. The rebake work from step 6 carries over either way.

---

## Stretch goals (post-v1)

- **Blendshape export.** FBX `BlendShape`/`BlendShapeChannel` nodes mapped from VRM expressions.
- **`@pixiv/three-vrm` integration** for spring-bone-aware preview.
- **MToon texture preservation** in FBX `Video` nodes.
- **Batch mode** — multiple VRMs in, one FBX each.
- **VRMA (VRM Animation) → FBX animation track** export.
- **PWA install** for offline desktop-style use.
- **Bone rename / remap UI** for VRMs with unusual hierarchies.

---

## Open questions for the implementer to ask the user

If unclear, ask before guessing:

1. Which Shogun product and version is the target? Shogun Live 1.x, Shogun Post 1.x, or both? (Affects test plan.)
2. Do you have a specific VRM you want as the primary test fixture? Otherwise default to a VRoid CC0 sample.
3. Shogun project axis convention: Z-up or Y-up? (Affects whether FBX should declare Y-up or pre-rotate.)
4. Project units in Shogun: mm, cm, or m? (Affects `UnitScaleFactor`.)
5. Accent color preference? (Suggest desaturated blue `#3b6ea8` or warm orange `#d97757`.)
6. Should textures be embedded in the FBX (larger file) or omitted (cleaner, user re-links)?

---

## References

- VRM 1.0 spec: https://github.com/vrm-c/vrm-specification/tree/master/specification/VRMC_vrm-1.0
- VRM 0.x spec: https://github.com/vrm-c/vrm-specification/tree/master/specification/0.0
- glTF 2.0 spec: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
- FBX ASCII format notes (Blender source is the most reliable reference): https://github.com/blender/blender/blob/main/source/blender/io/fbx/
- `three-fbx-exporter`: https://github.com/yomotsu/three-fbx-exporter
- Three.js `GLTFLoader`: https://threejs.org/docs/#examples/en/loaders/GLTFLoader
- Vicon Shogun docs: https://docs.vicon.com/display/Shogun

---

## License

MIT for the project. Any bundled sample VRMs must be CC0 or equivalent.
