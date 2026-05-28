import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const BG = 0x0e1014;

export class PreviewScene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private grid: THREE.GridHelper;
  private current: THREE.Object3D | null = null;
  private gizmos: THREE.Group | null = null;
  private gizmosVisible = false;
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

  setModel(object: THREE.Object3D) {
    this.clearModel();
    this.current = object;
    this.scene.add(object);
    this.frame(object);
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
    group.visible = this.gizmosVisible;
    this.gizmos = group;
    this.scene.add(group);
  }

  setGizmosVisible(visible: boolean) {
    this.gizmosVisible = visible;
    if (this.gizmos) this.gizmos.visible = visible;
  }

  private clearGizmos() {
    if (!this.gizmos) return;
    this.scene.remove(this.gizmos);
    this.gizmos.traverse((o) => {
      const ax = o as THREE.AxesHelper;
      if (ax.geometry) ax.geometry.dispose();
      const mat = (ax as any).material as THREE.Material | undefined;
      if (mat) mat.dispose();
    });
    this.gizmos = null;
  }

  private frame(object: THREE.Object3D) {
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const dist = maxDim / (2 * Math.tan((this.camera.fov * Math.PI) / 360));

    this.controls.target.copy(center);
    this.camera.position.set(center.x, center.y + size.y * 0.1, center.z + dist * 1.6);
    this.camera.near = maxDim / 100;
    this.camera.far = maxDim * 100;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  clearModel() {
    this.clearGizmos();
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
