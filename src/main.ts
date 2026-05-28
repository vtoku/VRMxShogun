import "./style.css";
import { parseGLB } from "./vrm/glb";
import { extractVrm } from "./vrm/humanoid";
import type { VrmInfo } from "./vrm/humanoid";
import { loadGltf } from "./vrm/loadGltf";
import { PreviewScene } from "./preview/scene";
import { buildModel, downloadText, sanitizeFilename } from "./fbx/export";
import { renderPanel } from "./ui/metadata";

const emptyState = document.getElementById("empty-state")!;
const loadedState = document.getElementById("loaded-state")!;
const dropzone = document.getElementById("dropzone")!;
const fileInput = document.getElementById("file-input") as HTMLInputElement;
const errorEl = document.getElementById("empty-error")!;
const viewport = document.getElementById("viewport")!;
const panel = document.getElementById("panel")!;

let preview: PreviewScene | null = null;

function showError(msg: string) {
  errorEl.textContent = msg;
  errorEl.hidden = false;
}
function clearError() {
  errorEl.hidden = true;
}

function showEmpty() {
  loadedState.hidden = true;
  emptyState.hidden = false;
  if (preview) {
    preview.dispose();
    preview = null;
  }
}

async function handleFile(file: File) {
  clearError();
  if (!/\.(vrm|glb)$/i.test(file.name)) {
    showError("Please choose a .vrm or .glb file.");
    return;
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    showError("Could not read the file.");
    return;
  }

  let vrm: VrmInfo | null = null;
  try {
    const { json } = parseGLB(buffer);
    vrm = extractVrm(json);
  } catch (e) {
    showError(e instanceof Error ? e.message : "Failed to parse the file.");
    return;
  }

  let gltf;
  try {
    gltf = await loadGltf(buffer);
  } catch (e) {
    showError(
      "Failed to load the 3D model: " +
        (e instanceof Error ? e.message : String(e)),
    );
    return;
  }

  // Normalize VRM 0.x forward axis to match VRM 1.0 (three-vrm does the same).
  if (vrm?.version === "0.x") gltf.scene.rotateY(Math.PI);

  // Swap to loaded layout.
  emptyState.hidden = true;
  loadedState.hidden = false;
  if (preview) preview.dispose();
  preview = new PreviewScene(viewport);
  preview.setModel(gltf.scene);

  // Build the export model (rebake + skin clusters) up front.
  const { result, toFbx } = buildModel(gltf.scene, vrm);

  const handles = renderPanel(panel, {
    filename: file.name,
    fileSize: file.size,
    vrm,
    boneCount: result.model.boneCount,
    meshCount: result.model.meshes.length,
    vertexCount: result.model.totalVertices,
  });

  handles.downloadBtn.addEventListener("click", () => {
    const btn = handles.downloadBtn;
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Building FBX…";
    // Defer so the button repaint lands before the (sync) FBX build.
    setTimeout(() => {
      try {
        const fbx = toFbx();
        downloadText(`${sanitizeFilename(file.name)}.fbx`, fbx);
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
