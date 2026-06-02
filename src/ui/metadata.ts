import type { VrmInfo } from "../vrm/humanoid";

export interface PanelData {
  filename: string;
  fileSize: number;
  vrm: VrmInfo | null;
  boneCount: number;
  meshCount: number;
  vertexCount: number;
  springCount: number;
  /** Shogun-specific issues collected upstream; rendered as a single box. */
  warnings: string[];
}

export interface PanelHandles {
  downloadBtn: HTMLButtonElement;
  reloadLink: HTMLButtonElement;
  stripCheckbox: HTMLInputElement | null;
  showBonesCheckbox: HTMLInputElement;
  skeletonCheckbox: HTMLInputElement;
  zUpRadio: HTMLInputElement;
  yUpRadio: HTMLInputElement;
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

  const warningsBlock =
    data.warnings.length > 0
      ? `<div class="warnings">
          <div class="warnings-title">Warnings (${data.warnings.length})</div>
          <ul>${data.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul>
        </div>`
      : "";

  const stripOption =
    data.springCount > 0
      ? `<label class="opt">
          <input type="checkbox" id="strip-springs" checked />
          <span>Strip spring bones (${data.springCount})</span>
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

    ${warningsBlock}

    <div class="options">
      ${stripOption}
      <label class="opt">
        <input type="checkbox" id="show-bones" checked />
        <span>Show bones</span>
      </label>
      <label class="opt">
        <input type="checkbox" id="skeleton-only" />
        <span>Skeleton only</span>
      </label>
      <div class="up-axis">
        <span class="up-axis-label">Up axis</span>
        <label><input type="radio" name="up-axis" id="up-y" /> Y-up (Maya)</label>
        <label><input type="radio" name="up-axis" id="up-z" checked /> Z-up (Shogun)</label>
      </div>
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
    skeletonCheckbox: panel.querySelector<HTMLInputElement>("#skeleton-only")!,
    zUpRadio: panel.querySelector<HTMLInputElement>("#up-z")!,
    yUpRadio: panel.querySelector<HTMLInputElement>("#up-y")!,
  };
}
