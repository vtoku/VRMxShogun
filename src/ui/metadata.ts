import type { VrmInfo } from "../vrm/humanoid";
import { REQUIRED_HUMANOID_BONES } from "../vrm/humanoid";

export interface PanelData {
  filename: string;
  fileSize: number;
  vrm: VrmInfo | null;
  boneCount: number;
  meshCount: number;
  vertexCount: number;
}

export interface PanelHandles {
  downloadBtn: HTMLButtonElement;
  reloadLink: HTMLButtonElement;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function row(label: string, value: string): string {
  return `<div class="row"><span class="row-label">${label}</span><span class="row-value">${escapeHtml(
    value,
  )}</span></div>`;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

export function renderPanel(panel: HTMLElement, data: PanelData): PanelHandles {
  const v = data.vrm;
  const totalHumanoid = v ? Object.keys(v.humanoidBones).length : 0;
  const missing = v
    ? REQUIRED_HUMANOID_BONES.filter((b) => !(b in v.humanoidBones))
    : REQUIRED_HUMANOID_BONES;

  const warn =
    missing.length > 0
      ? `<div class="warn">Missing required humanoid bones: ${escapeHtml(
          missing.join(", "),
        )}. The FBX will still export, but Shogun retargeting may be incomplete.</div>`
      : "";

  const notVrm = !v
    ? `<div class="warn">No VRM humanoid extension found — exporting raw glTF skeleton with original bone names.</div>`
    : "";

  panel.innerHTML = `
    <div class="file-head">
      <div class="file-name" title="${escapeHtml(data.filename)}">${escapeHtml(data.filename)}</div>
      <div class="file-size">${fmtSize(data.fileSize)}</div>
    </div>

    <div class="rows">
      ${row("Title", v?.meta.title ?? "—")}
      ${row("Author", v?.meta.author ?? "—")}
      ${row("License", v?.meta.license ?? "—")}
      ${row("Version", v ? `VRM ${v.meta.version}` : "glTF (no VRM)")}
    </div>

    <div class="rows">
      ${row("Skeleton", `${data.boneCount} bones`)}
      ${row("Humanoid", v ? `${totalHumanoid} bones` : "—")}
      ${row("Meshes", `${data.meshCount} (${data.vertexCount.toLocaleString()} verts)`)}
    </div>

    ${warn}${notVrm}

    <button id="download-btn" class="download-btn">Download FBX</button>

    <div class="notes">
      <p>The bone hierarchy and names are preserved exactly from the VRM. Only the
      bind-pose orientation is rebaked to world-aligned (the Maya joint convention
      Shogun expects) — names and parenting are untouched.</p>
      <p>Textures, MToon shaders, blendshapes, spring bones, and animation are
      <strong>not</strong> included in v1. Everything runs in your browser —
      nothing is uploaded.</p>
      <p class="muted">If Shogun imports at the wrong scale or rotation, see the
      README "Axis &amp; scale" note.</p>
    </div>

    <button id="reload-link" class="reload-link">Load a different file</button>
  `;

  return {
    downloadBtn: panel.querySelector<HTMLButtonElement>("#download-btn")!,
    reloadLink: panel.querySelector<HTMLButtonElement>("#reload-link")!,
  };
}
