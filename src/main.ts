import "./style.css";
import type { Bone, Object3D } from "three";
import { parseGLB } from "./vrm/glb";
import { extractVrm } from "./vrm/humanoid";
import type { VrmInfo } from "./vrm/humanoid";
import { extractSpringNodeIndices } from "./vrm/springs";
import { loadGltf } from "./vrm/loadGltf";
import { PreviewScene } from "./preview/scene";
import { buildModel, downloadText, sanitizeFilename } from "./fbx/export";
import type { BuildResult } from "./convert/build";
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
interface Loaded {
  scene: Object3D;
  vrm: VrmInfo | null;
  springBones: Set<Bone>;
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

// Exported bone world positions (meters) for the preview axis gizmos.
function gizmoPositions(result: BuildResult): Array<[number, number, number]> {
  return result.model.bones.map((b) => [
    b.worldPos[0] / 100,
    b.worldPos[1] / 100,
    b.worldPos[2] / 100,
  ]);
}

// Map glTF node indices -> spring Bone objects, reliably, via GLTFLoader's
// associations (node names are sanitized/deduped, so name matching is unsafe).
function collectSpringBones(gltf: any, springIdx: Set<number>): Set<Bone> {
  const out = new Set<Bone>();
  const assoc: Map<any, any> | undefined = gltf.parser?.associations;
  if (!assoc || springIdx.size === 0) return out;
  for (const [obj, m] of assoc) {
    if (m && typeof m.nodes === "number" && springIdx.has(m.nodes) && obj.isBone) {
      out.add(obj as Bone);
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
    const buffer = await file.arrayBuffer();
    const { json } = parseGLB(buffer);
    const vrm: VrmInfo | null = extractVrm(json);
    const springIdx = extractSpringNodeIndices(json);
    const gltf = await loadGltf(buffer);

    // Normalize VRM 0.x forward axis to match VRM 1.0 (three-vrm does the same).
    if (vrm?.version === "0.x") gltf.scene.rotateY(Math.PI);

    const springBones = collectSpringBones(gltf, springIdx);

    // Let the bar paint before the heavy synchronous build (rebake + clusters).
    await nextPaint();
    const { result, toFbx } = buildModel(gltf.scene, vrm);

    // Reveal the loaded layout behind the loading overlay.
    if (preview) preview.dispose();
    loadedState.hidden = false;
    preview = new PreviewScene(viewport);
    preview.setModel(gltf.scene);
    preview.setBoneGizmos(gizmoPositions(result));

    loaded = { scene: gltf.scene, vrm, springBones, file, toFbx };

    const handles = renderPanel(panel, {
      filename: file.name,
      fileSize: file.size,
      vrm,
      boneCount: result.model.boneCount,
      meshCount: result.model.meshes.length,
      vertexCount: result.model.totalVertices,
      springCount: springBones.size,
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

  if (handles.stripCheckbox) {
    handles.stripCheckbox.addEventListener("change", () => void reprocess(handles));
  }
}

// Rebuild the export model when the spring-strip toggle changes, showing the
// loading overlay while it reprocesses.
async function reprocess(handles: PanelHandles) {
  if (!loaded || !preview) return;
  const strip = handles.stripCheckbox?.checked ?? false;

  loadingName.textContent = loaded.file.name;
  loadingState.hidden = false;
  await nextPaint();

  const { result, toFbx } = buildModel(
    loaded.scene,
    loaded.vrm,
    strip ? loaded.springBones : undefined,
  );
  loaded.toFbx = toFbx;
  preview.setBoneGizmos(gizmoPositions(result));
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
