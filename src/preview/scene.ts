import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const BG = 0x0e1014;

// A billboard text label (X/Y/Z) for the root axis gizmo.
function makeAxisLabel(text: string, color: string): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.font = "bold 38px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(text, 32, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.renderOrder = 1001;
  return sprite;
}

export class PreviewScene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private grid: THREE.GridHelper;
  private current: THREE.Object3D | null = null;
  private gizmos: THREE.Group | null = null;
  private gizmosVisible = false;
  private wireframe: THREE.LineSegments | null = null;
  private wireframeVisible = false;
  private renderWaiters: Array<() => void> = [];
  private ro: ResizeObserver;
  private rafId = 0;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BG);

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
    this.camera.position.set(0, 1.3, 3);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 1.0, 0);

    const key = new THREE.DirectionalLight(0xffffff, 2.8);
    key.position.set(1, 2, 2);
    const fill = new THREE.DirectionalLight(0xffffff, 1.3);
    fill.position.set(-1, 1, -1);
    const rim = new THREE.DirectionalLight(0xffffff, 1.0);
    rim.position.set(0, 1.5, -2);
    this.scene.add(
      key,
      fill,
      rim,
      new THREE.HemisphereLight(0xffffff, 0x40404c, 1.1),
      new THREE.AmbientLight(0xffffff, 0.7),
    );

    this.grid = new THREE.GridHelper(10, 20, 0x2a2f3a, 0x1b1f27);
    this.scene.add(this.grid);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.animate();
  }

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private animate = () => {
    this.rafId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (this.renderWaiters.length) {
      const waiters = this.renderWaiters;
      this.renderWaiters = [];
      for (const f of waiters) f();
    }
  };

  /** Resolves after the next frame has actually been rendered. */
  nextRender(): Promise<void> {
    return new Promise((resolve) => this.renderWaiters.push(resolve));
  }

  setModel(object: THREE.Object3D, focusBox?: THREE.Box3) {
    this.clearModel();
    this.current = object;
    this.scene.add(object);
    this.frame(object, focusBox);
  }

  // Axis gizmos at each exported bone's world position. Bones are rebaked to
  // identity rotation, so every gizmo shares world orientation — which is the
  // point: it shows the Maya world-aligned convention the FBX exports.
  setBoneGizmos(positionsMeters: Array<[number, number, number]>, size = 0.04) {
    this.clearGizmos();
    const group = new THREE.Group();
    for (const p of positionsMeters) {
      const ax = new THREE.AxesHelper(size);
      ax.position.set(p[0], p[1], p[2]);
      const mat = ax.material as THREE.Material;
      mat.depthTest = false;
      mat.transparent = true;
      ax.renderOrder = 999;
      group.add(ax);
    }
    // Export root frame at the world origin (the FBX scene root), drawn larger
    // so it's distinguishable from the per-bone gizmos, with X/Y/Z labels.
    const rootSize = size * 3.5;
    const root = new THREE.AxesHelper(rootSize);
    const rootMat = root.material as THREE.Material;
    rootMat.depthTest = false;
    rootMat.transparent = true;
    root.renderOrder = 1000;
    group.add(root);

    const ld = rootSize * 1.15;
    const ls = size * 1.3;
    const addLabel = (t: string, color: string, x: number, y: number, z: number) => {
      const sp = makeAxisLabel(t, color);
      sp.position.set(x, y, z);
      sp.scale.setScalar(ls);
      group.add(sp);
    };
    addLabel("X", "#ff5555", ld, 0, 0);
    addLabel("Y", "#55ff77", 0, ld, 0);
    addLabel("Z", "#5588ff", 0, 0, ld);

    group.visible = this.gizmosVisible;
    this.gizmos = group;
    this.scene.add(group);
  }

  setGizmosVisible(visible: boolean) {
    this.gizmosVisible = visible;
    if (this.gizmos) this.gizmos.visible = visible;
  }

  // Diamond/octahedral bone wireframe (flat line-segment endpoints, meters).
  setBoneWireframe(positions: number[]) {
    this.clearWireframe();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0xb7c0cc,
      transparent: true,
      depthTest: false,
    });
    const seg = new THREE.LineSegments(geo, mat);
    seg.renderOrder = 998;
    seg.visible = this.wireframeVisible;
    this.wireframe = seg;
    this.scene.add(seg);
  }

  setWireframeVisible(visible: boolean) {
    this.wireframeVisible = visible;
    if (this.wireframe) this.wireframe.visible = visible;
  }

  setModelVisible(visible: boolean) {
    if (this.current) this.current.visible = visible;
  }

  private clearWireframe() {
    if (!this.wireframe) return;
    this.scene.remove(this.wireframe);
    this.wireframe.geometry.dispose();
    (this.wireframe.material as THREE.Material).dispose();
    this.wireframe = null;
  }

  private clearGizmos() {
    if (!this.gizmos) return;
    this.scene.remove(this.gizmos);
    this.gizmos.traverse((o) => {
      const any = o as any;
      if (any.geometry) any.geometry.dispose();
      const mat = any.material as (THREE.Material & { map?: THREE.Texture }) | undefined;
      if (mat) {
        mat.map?.dispose();
        mat.dispose();
      }
    });
    this.gizmos = null;
  }

  // focusBox (if given, e.g. the humanoid body bones) is framed instead of the
  // full object bounds, so wings/props/hair don't shove the body off-center.
  private frame(object: THREE.Object3D, focusBox?: THREE.Box3) {
    object.updateWorldMatrix(true, true);
    const box =
      focusBox && !focusBox.isEmpty()
        ? focusBox
        : new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    // distance to fit the largest dimension in view, plus a small margin
    const dist = (maxDim / (2 * Math.tan((this.camera.fov * Math.PI) / 360))) * 1.4;

    // VRMs are rooted at the origin, so center horizontally on the root axis
    // (x=z=0) and vertically on the body center — avoids offset from asymmetric
    // meshes/accessories.
    this.controls.target.set(0, center.y, 0);
    this.camera.position.set(0, center.y, dist);
    this.camera.near = maxDim / 100;
    this.camera.far = maxDim * 100;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  clearModel() {
    this.clearGizmos();
    this.clearWireframe();
    if (!this.current) return;
    this.scene.remove(this.current);
    this.current.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = (mesh as THREE.Mesh).material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) (mat as THREE.Material).dispose();
    });
    this.current = null;
  }

  dispose() {
    cancelAnimationFrame(this.rafId);
    this.ro.disconnect();
    this.clearModel();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
