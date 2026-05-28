import "./style.css";
import { parseGLB } from "./vrm/glb";
import { extractVrm } from "./vrm/humanoid";
import type { VrmInfo } from "./vrm/humanoid";
import { loadGltf } from "./vrm/loadGltf";
import { PreviewScene } from "./preview/scene";
import { buildModel, downloadText, sanitizeFilename } from "./fbx/export";
import { renderPanel } from "./ui/metadata";

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
    const gltf = await loadGltf(buffer);

    // Normalize VRM 0.x forward axis to match VRM 1.0 (three-vrm does the same).
    if (vrm?.version === "0.x") gltf.scene.rotateY(Math.PI);

    // Let the bar paint before the heavy synchronous build (rebake + clusters).
    await nextPaint();
    const { result, toFbx } = buildModel(gltf.scene, vrm);

    // Reveal the loaded layout.
    if (preview) preview.dispose();
    loadingState.hidden = true;
    loadedState.hidden = false;
    preview = new PreviewScene(viewport);
    preview.setModel(gltf.scene);

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
        downloadText(`${sanitizeFilename(file.name)}_retarget.fbx`, fbx);
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
  } catch (e) {
    showEmpty();
    showError(e instanceof Error ? e.message : "Failed to load the file.");
  }
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
