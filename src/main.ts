import "./style.css";
import { Box3, Vector3 } from "three";
import type { Object3D } from "three";
import { parseGLB, sanitizeGlb } from "./vrm/glb";
import { extractVrm, REQUIRED_HUMANOID_BONES } from "./vrm/humanoid";
import type { VrmInfo } from "./vrm/humanoid";
import { extractSpringNodeIndices } from "./vrm/springs";
import { loadGltf } from "./vrm/loadGltf";
import { PreviewScene } from "./preview/scene";
import { buildModel, downloadText, sanitizeFilename } from "./fbx/export";
import type { BuildInput, BuildResult } from "./convert/build";
import { boneDiamondEdges } from "./convert/boneViz";
import { renderPanel } from "./ui/metadata";
import type { PanelHandles } from "./ui/metadata";

const emptyState = document.getElementById("empty-state")!;
const loadingState = document.getElementById("loading-state")!;
const loadingName = document.getElementById("loading-name")!;
const loadedState = document.getElementById("loaded-state")!;
const dropzone = document.getElementById("dropzone")!;
const fileInput = document.getElementById("file-input") as HTMLInputElement;
const errorEl = document.getElementById("empty-error")!;
const viewport = document.getElementById("viewport")!;
const panel = document.getElementById("panel")!;

let preview: PreviewScene | null = null;

// Everything needed to re-export the current model (e.g. when the spring-strip
// toggle changes) without re-parsing the file.
type BaseInput = Omit<BuildInput, "stripSprings">;
interface Loaded {
  base: BaseInput;
  file: File;
  toFbx: () => string;
}
let loaded: Loaded | null = null;

function showError(msg: string) {
  errorEl.textContent = msg;
  errorEl.hidden = false;
}
function clearError() {
  errorEl.hidden = true;
}

function showLoading(name: string) {
  emptyState.hidden = true;
  loadedState.hidden = true;
  loadingName.textContent = name;
  loadingState.hidden = false;
}

function showEmpty() {
  loadingState.hidden = true;
  loadedState.hidden = true;
  emptyState.hidden = false;
  loaded = null;
  if (preview) {
    preview.dispose();
    preview = null;
  }
}

// Yield to the browser so the loading bar paints before the synchronous,
// main-thread-blocking parse + build runs. (Two frames = a guaranteed paint.)
function nextPaint(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

// Bounding box (meters) of just the humanoid body bones, so the preview frames
// the body and ignores wings/props/hair that would otherwise off-center it.
function humanoidFocusBox(
  vrm: VrmInfo | null,
  nodeToObj: Map<number, Object3D>,
): Box3 | null {
  if (!vrm) return null;
  const box = new Box3();
  const v = new Vector3();
  let any = false;
  for (const ref of Object.values(vrm.humanoidBones)) {
    const obj = nodeToObj.get(ref.nodeIndex);
    if (obj) {
      obj.getWorldPosition(v);
      box.expandByPoint(v);
      any = true;
    }
  }
  if (!any) return null;
  const size = box.getSize(new Vector3());
  box.expandByScalar(Math.max(size.x, size.y, size.z) * 0.12); // headroom for head/feet/hands mesh
  return box;
}

// Exported bone world positions (meters) for the preview axis gizmos.
function gizmoPositions(result: BuildResult): Array<[number, number, number]> {
  return result.model.bones.map((b) => [
    b.worldPos[0] / 100,
    b.worldPos[1] / 100,
    b.worldPos[2] / 100,
  ]);
}

// Export-bone indices above the humanoid hips (armature/container chain), so the
// preview wireframe starts at the pelvis instead of drawing giant origin->hip bones.
function hipsAncestors(result: BuildResult, vrm: VrmInfo | null): Set<number> {
  const skip = new Set<number>();
  const hipsName = vrm?.humanoidBones?.hips?.nodeName;
  if (!hipsName) return skip;
  const bones = result.model.bones;
  const hipsIdx = bones.findIndex((b) => b.name === hipsName);
  if (hipsIdx < 0) return skip;
  let p = bones[hipsIdx].parentIndex;
  while (p >= 0) {
    skip.add(p);
    p = bones[p].parentIndex;
  }
  return skip;
}

// Update the preview's bone gizmos + diamond wireframe, and toggle whether the
// mesh or the wireframe armature is shown (skeleton-only mode).
function applyBoneVisuals(
  result: BuildResult,
  vrm: VrmInfo | null,
  skeletonOnly: boolean,
  upAxis: "y" | "z",
) {
  if (!preview) return;
  const skip = hipsAncestors(result, vrm);
  preview.setBoneGizmos(gizmoPositions(result));
  preview.setBoneWireframe(boneDiamondEdges(result.model.bones, 0.01, skip));
  preview.setWireframeVisible(skeletonOnly);
  preview.setModelVisible(!skeletonOnly);
  preview.setUpAxis(upAxis);
}

// Node-index <-> object maps from GLTFLoader associations, so the export uses
// authoritative glTF node names + hierarchy (not GLTFLoader's sanitized names).
function buildNodeMaps(gltf: any): {
  nodeToObj: Map<number, Object3D>;
  objToNode: Map<Object3D, number>;
} {
  const nodeToObj = new Map<number, Object3D>();
  const objToNode = new Map<Object3D, number>();
  const assoc: Map<any, any> | undefined = gltf.parser?.associations;
  if (assoc) {
    for (const [obj, m] of assoc) {
      if (m && typeof m.nodes === "number") {
        nodeToObj.set(m.nodes, obj as Object3D);
        objToNode.set(obj as Object3D, m.nodes);
      }
    }
  }
  return { nodeToObj, objToNode };
}

// Surface issues a user is likely to hit in Shogun, based on Shogun's docs and
// Maya-derived name sanitisation. One string per issue; rendered as a single
// Warnings list in the panel.
function collectWarnings(result: BuildResult, vrm: VrmInfo | null): string[] {
  const out: string[] = [];
  const bones = result.model.bones;
  const names = bones.map((b) => b.name);
  const sample = (arr: string[]) =>
    arr.slice(0, 4).join(", ") + (arr.length > 4 ? "…" : "");

  if (!vrm) {
    out.push(
      'No VRM humanoid extension found — exporting the raw glTF skeleton. Shogun won\'t recognise humanoid bone roles automatically.',
    );
  } else {
    const missing = REQUIRED_HUMANOID_BONES.filter((b) => !(b in vrm.humanoidBones));
    if (missing.length) {
      out.push(
        `Missing required humanoid bones: ${missing.join(", ")}. Retargeting in Shogun may be incomplete.`,
      );
    }
  }

  const hyphen = names.filter((n) => n.includes("-"));
  if (hyphen.length) {
    out.push(
      `${hyphen.length} bone name(s) contain "-" (e.g. ${sample(hyphen)}). Shogun converts "-" to "_" on import, which breaks name-based retargeting back out (e.g. to Unity).`,
    );
  }

  const dot = names.filter((n) => n.includes("."));
  if (dot.length) {
    out.push(
      `${dot.length} bone name(s) contain "." (e.g. ${sample(dot)}). Maya-based tools may strip the dot on import (e.g. "spine.001" → "spine001"), desyncing names from the source VRM.`,
    );
  }

  const space = names.filter((n) => n.includes(" "));
  if (space.length) {
    out.push(
      `${space.length} bone name(s) contain spaces (e.g. ${sample(space)}). Maya/Shogun replace spaces with "_" on import.`,
    );
  }

  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  const dupes = [...counts.entries()].filter(([, c]) => c > 1).map(([n]) => n);
  if (dupes.length) {
    out.push(
      `${dupes.length} duplicate bone name(s): ${sample(dupes)}. Shogun can't distinguish bones with the same name.`,
    );
  }

  // Above-root non-zero transforms (per Shogun "Create an optimal target skeleton")
  const hipsName = vrm?.humanoidBones?.hips?.nodeName;
  if (hipsName) {
    const hipsIdx = bones.findIndex((b) => b.name === hipsName);
    if (hipsIdx >= 0) {
      const offenders: string[] = [];
      let p = bones[hipsIdx].parentIndex;
      while (p >= 0) {
        const [x, y, z] = bones[p].worldPos;
        if (Math.abs(x) > 0.01 || Math.abs(y) > 0.01 || Math.abs(z) > 0.01) {
          offenders.push(bones[p].name);
        }
        p = bones[p].parentIndex;
      }
      if (offenders.length) {
        out.push(
          `Nodes above the hips have non-zero transforms: ${offenders.join(", ")}. Per Shogun's docs you may need to adjust the hierarchy in Post after import.`,
        );
      }
    }
  }

  // Humanoid skeleton scale sanity check (worldPos is in cm)
  if (vrm) {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const ref of Object.values(vrm.humanoidBones)) {
      const b = bones.find((x) => x.name === ref.nodeName);
      if (!b) continue;
      minY = Math.min(minY, b.worldPos[1]);
      maxY = Math.max(maxY, b.worldPos[1]);
    }
    if (Number.isFinite(minY) && Number.isFinite(maxY)) {
      const heightCm = maxY - minY;
      if (heightCm < 30 || heightCm > 400) {
        out.push(
          `Humanoid skeleton spans ${heightCm.toFixed(0)} cm — unusual height; double-check the source VRM's scale before retargeting.`,
        );
      }
    }
  }

  return out;
}

async function handleFile(file: File) {
  clearError();
  if (!/\.(vrm|glb)$/i.test(file.name)) {
    showError("Please choose a .vrm or .glb file.");
    return;
  }

  showLoading(file.name);
  await nextPaint();

  try {
    // Patch invalid NaN/Infinity in the JSON chunk before either parser sees it.
    const buffer = sanitizeGlb(await file.arrayBuffer());
    const { json } = parseGLB(buffer);
    const vrm: VrmInfo | null = extractVrm(json);
    const springNodes = extractSpringNodeIndices(json);
    const gltf = await loadGltf(buffer);

    // Normalize VRM 0.x forward axis to match VRM 1.0 (three-vrm does the same).
    if (vrm?.version === "0.x") gltf.scene.rotateY(Math.PI);

    // Bad accessor min/max (e.g. from NaN) yields wrong bounds; recompute from
    // the actual vertices so framing/culling are correct.
    gltf.scene.traverse((o) => {
      const mesh = o as any;
      if (mesh.isMesh && mesh.geometry) {
        mesh.geometry.computeBoundingBox();
        mesh.geometry.computeBoundingSphere();
        mesh.frustumCulled = false;
      }
    });

    const { nodeToObj, objToNode } = buildNodeMaps(gltf);
    const base: BaseInput = {
      scene: gltf.scene,
      vrm,
      json,
      nodeToObj,
      objToNode,
      springNodes,
    };

    // Let the bar paint before the heavy synchronous build (rebake + clusters).
    // Defaults: strip springs ON (when present) and gizmos visible.
    await nextPaint();
    const stripDefault = base.springNodes.size > 0;
    const { result, toFbx } = buildModel({
      ...base,
      stripSprings: stripDefault,
      rotateExport: true, // Z-up (Shogun) by default
    });

    // Reveal the loaded layout behind the loading overlay.
    if (preview) preview.dispose();
    loadedState.hidden = false;
    preview = new PreviewScene(viewport);
    preview.setModel(gltf.scene, humanoidFocusBox(vrm, nodeToObj) ?? undefined);
    preview.setGizmosVisible(true);
    applyBoneVisuals(result, vrm, false, "z");

    loaded = { base, file, toFbx };

    const handles = renderPanel(panel, {
      filename: file.name,
      fileSize: file.size,
      vrm,
      boneCount: result.model.boneCount,
      meshCount: result.model.meshes.length,
      vertexCount: result.model.totalVertices,
      springCount: result.springBoneCount,
      warnings: collectWarnings(result, vrm),
    });
    wireHandlers(handles);

    // Keep the loading overlay up until the model has actually rendered.
    await preview.nextRender();
    await preview.nextRender();
    loadingState.hidden = true;
  } catch (e) {
    showEmpty();
    showError(e instanceof Error ? e.message : "Failed to load the file.");
  }
}

function wireHandlers(handles: PanelHandles) {
  handles.downloadBtn.addEventListener("click", () => {
    if (!loaded) return;
    const btn = handles.downloadBtn;
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Building FBX…";
    // Defer so the button repaint lands before the (sync) FBX build.
    setTimeout(() => {
      try {
        downloadText(`${sanitizeFilename(loaded!.file.name)}_retarget.fbx`, loaded!.toFbx());
      } catch (e) {
        showError("FBX export failed: " + (e instanceof Error ? e.message : String(e)));
      } finally {
        btn.disabled = false;
        btn.textContent = original;
      }
    }, 30);
  });

  handles.reloadLink.addEventListener("click", () => {
    fileInput.value = "";
    showEmpty();
  });

  handles.showBonesCheckbox.addEventListener("change", () => {
    preview?.setGizmosVisible(handles.showBonesCheckbox.checked);
  });

  handles.skeletonCheckbox.addEventListener("change", () => void reprocess(handles));
  handles.zUpRadio.addEventListener("change", () => void reprocess(handles));
  handles.yUpRadio.addEventListener("change", () => void reprocess(handles));

  if (handles.stripCheckbox) {
    handles.stripCheckbox.addEventListener("change", () => void reprocess(handles));
  }
}

// Rebuild the export model when the spring-strip toggle changes, showing the
// loading overlay while it reprocesses.
async function reprocess(handles: PanelHandles) {
  if (!loaded || !preview) return;
  const strip = handles.stripCheckbox?.checked ?? false;
  const skeletonOnly = handles.skeletonCheckbox.checked;
  const rotateExport = handles.zUpRadio.checked;

  loadingName.textContent = loaded.file.name;
  loadingState.hidden = false;
  await nextPaint();

  const { result, toFbx } = buildModel({
    ...loaded.base,
    stripSprings: strip,
    skeletonOnly,
    rotateExport,
  });
  loaded.toFbx = toFbx;
  applyBoneVisuals(result, loaded.base.vrm, skeletonOnly, rotateExport ? "z" : "y");
  const count = panel.querySelector("#bone-count");
  if (count) count.textContent = String(result.model.boneCount);

  await preview.nextRender();
  loadingState.hidden = true;
}

// ---- drag & drop (whole page) + click-to-pick ---------------------------
dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});
fileInput.addEventListener("change", () => {
  const f = fileInput.files?.[0];
  if (f) void handleFile(f);
});

let dragDepth = 0;
window.addEventListener("dragenter", (e) => {
  e.preventDefault();
  dragDepth++;
  document.body.classList.add("dragging");
});
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("dragleave", (e) => {
  e.preventDefault();
  if (--dragDepth <= 0) document.body.classList.remove("dragging");
});
window.addEventListener("drop", (e) => {
  e.preventDefault();
  dragDepth = 0;
  document.body.classList.remove("dragging");
  const f = e.dataTransfer?.files?.[0];
  if (f) void handleFile(f);
});
