import type { VrmInfo } from "../vrm/humanoid";
import { REQUIRED_HUMANOID_BONES } from "../vrm/humanoid";

export interface PanelData {
  filename: string;
  fileSize: number;
  vrm: VrmInfo | null;
  boneCount: number;
  meshCount: number;
  vertexCount: number;
  springCount: number;
  hyphenBones: string[];
}

export interface PanelHandles {
  downloadBtn: HTMLButtonElement;
  reloadLink: HTMLButtonElement;
  stripCheckbox: HTMLInputElement | null;
  showBonesCheckbox: HTMLInputElement;
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
        )}. The FBX will still export, but retargeting may be incomplete.</div>`
      : "";

  const notVrm = !v
    ? `<div class="warn">No VRM humanoid extension found — exporting the raw glTF skeleton.</div>`
    : "";

  const hyphenWarn =
    data.hyphenBones.length > 0
      ? `<div class="warn">${data.hyphenBones.length} bone name(s) contain "-": ${escapeHtml(
          data.hyphenBones.slice(0, 6).join(", "),
        )}${data.hyphenBones.length > 6 ? "…" : ""}. Shogun converts "-" to "_" on import, so these won't match their original names when retargeting back out (e.g. to Unity). Consider renaming them in the VRM first.</div>`
      : "";

  const stripOption =
    data.springCount > 0
      ? `<label class="opt">
          <input type="checkbox" id="strip-springs" />
          <span>Strip spring bones (${data.springCount}) — reweights hair/skirt to parent</span>
        </label>`
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
      <div class="row"><span class="row-label">Export bones</span><span class="row-value"><span id="bone-count">${data.boneCount}</span> bones</span></div>
      ${row("Humanoid", v ? `${totalHumanoid} bones` : "—")}
      ${row("Spring bones", `${data.springCount}`)}
      ${row("Meshes", `${data.meshCount} (${data.vertexCount.toLocaleString()} verts)`)}
    </div>

    ${warn}${notVrm}${hyphenWarn}

    <div class="options">
      ${stripOption}
      <label class="opt">
        <input type="checkbox" id="show-bones" />
        <span>Show export bones (axis gizmos)</span>
      </label>
    </div>

    <button id="download-btn" class="download-btn">Download FBX</button>

    <div class="notes">
      <p>Textures, blendshapes, and animation aren't exported.</p>
      <p class="muted">Runs only in your browser.</p>
    </div>

    <button id="reload-link" class="reload-link">Load a different file</button>
  `;

  return {
    downloadBtn: panel.querySelector<HTMLButtonElement>("#download-btn")!,
    reloadLink: panel.querySelector<HTMLButtonElement>("#reload-link")!,
    stripCheckbox: panel.querySelector<HTMLInputElement>("#strip-springs"),
    showBonesCheckbox: panel.querySelector<HTMLInputElement>("#show-bones")!,
  };
}
