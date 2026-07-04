import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { PRODUCTS } from "./products.js";

const $ = (id) => document.getElementById(id);
const intro = $("intro");
const arLayer = $("arLayer");
const host = $("rendererHost");
const statusText = $("statusText");
const metricText = $("metricText");
const scanGuide = $("scanGuide");
const unsupported = $("unsupported");
const unsupportedText = $("unsupportedText");
const compatText = $("compatText");
const productList = $("productList");

let selectedProduct = PRODUCTS[0];
let engine = null;

function renderProducts() {
  productList.innerHTML = "";
  PRODUCTS.forEach((product) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `product-card${product.id === selectedProduct.id ? " selected" : ""}`;
    button.innerHTML = `
      <img src="${product.imageUrl}" alt="${product.name}" />
      <strong>${product.name}</strong>
      <span>${Math.round(product.widthM * 100)} × ${Math.round(product.heightM * 100)} cm</span>
    `;
    button.addEventListener("click", () => {
      selectedProduct = product;
      renderProducts();
    });
    productList.appendChild(button);
  });
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

async function detectCapability() {
  const hasXR = "xr" in navigator;
  let immersiveAR = false;
  if (hasXR) {
    try { immersiveAR = await navigator.xr.isSessionSupported("immersive-ar"); }
    catch { immersiveAR = false; }
  }

  if (immersiveAR) {
    compatText.textContent = "이 브라우저는 WebXR AR을 지원합니다. 벽 hit-test가 잡히면 자동 배치합니다.";
  } else if (isIOS()) {
    compatText.textContent = "iOS Safari는 WebXR을 직접 지원하지 않습니다. 자동 벽면 AR은 Mattercraft/Zappar/Onirix 같은 WebAR SDK 연결이 필요합니다.";
  } else {
    compatText.textContent = "이 브라우저는 WebXR immersive-ar를 지원하지 않습니다. Android Chrome 또는 WebAR SDK 연결이 필요합니다.";
  }
  return { immersiveAR };
}

function showUnsupported(message) {
  unsupportedText.textContent = message;
  unsupported.classList.remove("hidden");
}

class WebXRAutoWallEngine {
  constructor({ host, product, onStatus, onMetrics, onPlaced }) {
    this.host = host;
    this.product = product;
    this.onStatus = onStatus;
    this.onMetrics = onMetrics;
    this.onPlaced = onPlaced;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.reticle = null;
    this.hitTestSource = null;
    this.localSpace = null;
    this.viewerSpace = null;
    this.session = null;
    this.posterGroup = null;
    this.posterMesh = null;
    this.stableFrames = 0;
    this.placed = false;
    this.lastHitMatrix = new THREE.Matrix4();
    this.tmpMatrix = new THREE.Matrix4();
    this.tmpQuat = new THREE.Quaternion();
    this.tmpScale = new THREE.Vector3();
    this.tmpPos = new THREE.Vector3();
    this.worldNormal = new THREE.Vector3();
    this.worldUp = new THREE.Vector3(0, 1, 0);
  }

  async start() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera();

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.xr.enabled = true;
    this.host.innerHTML = "";
    this.host.appendChild(this.renderer.domElement);

    this.addLights();
    await this.createPoster();
    this.createReticle();

    this.session = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ["hit-test"],
      optionalFeatures: ["anchors", "plane-detection", "dom-overlay"],
      domOverlay: { root: document.body }
    });

    this.session.addEventListener("end", () => this.stop());
    this.renderer.xr.setSession(this.session);
    this.localSpace = await this.session.requestReferenceSpace("local");
    this.viewerSpace = await this.session.requestReferenceSpace("viewer");
    this.hitTestSource = await this.session.requestHitTestSource({ space: this.viewerSpace });

    this.onStatus("벽면 자동 탐색 중");
    this.renderer.setAnimationLoop((time, frame) => this.render(time, frame));
    window.addEventListener("resize", this.resize);
  }

  stop() {
    window.removeEventListener("resize", this.resize);
    if (this.renderer) this.renderer.setAnimationLoop(null);
  }

  resize = () => {
    if (!this.renderer) return;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  addLights() {
    const ambient = new THREE.HemisphereLight(0xffffff, 0x333333, 1.8);
    this.scene.add(ambient);
  }

  async createPoster() {
    const texture = await new THREE.TextureLoader().loadAsync(this.product.imageUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    const geometry = new THREE.PlaneGeometry(this.product.widthM, this.product.heightM);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
    this.posterMesh = new THREE.Mesh(geometry, material);

    // WebXR hit-test pose uses the local X/Z plane as the surface plane in common implementations.
    // PlaneGeometry lies in X/Y, so rotate it into X/Z.
    this.posterMesh.rotation.x = -Math.PI / 2;
    this.posterMesh.position.y = 0.003;

    this.posterGroup = new THREE.Group();
    this.posterGroup.matrixAutoUpdate = false;
    this.posterGroup.visible = false;
    this.posterGroup.add(this.posterMesh);
    this.scene.add(this.posterGroup);
  }

  createReticle() {
    const ring = new THREE.RingGeometry(0.09, 0.105, 32).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    this.reticle = new THREE.Mesh(ring, mat);
    this.reticle.matrixAutoUpdate = false;
    this.reticle.visible = false;
    this.scene.add(this.reticle);
  }

  render(time, frame) {
    if (!frame) return;
    const referenceSpace = this.renderer.xr.getReferenceSpace();
    const hitTestResults = this.hitTestSource ? frame.getHitTestResults(this.hitTestSource) : [];

    if (hitTestResults.length > 0 && !this.placed) {
      const pose = hitTestResults[0].getPose(referenceSpace);
      if (pose) this.handleHitPose(pose);
    } else if (!this.placed) {
      this.reticle.visible = false;
      this.stableFrames = 0;
      this.onStatus("벽면을 찾는 중");
      this.onMetrics("거리 -- / 각도 --");
    }

    this.renderer.render(this.scene, this.camera);
  }

  handleHitPose(pose) {
    this.lastHitMatrix.fromArray(pose.transform.matrix);
    this.reticle.visible = true;
    this.reticle.matrix.copy(this.lastHitMatrix);

    this.tmpMatrix.copy(this.lastHitMatrix);
    this.tmpMatrix.decompose(this.tmpPos, this.tmpQuat, this.tmpScale);

    this.worldNormal.set(0, 1, 0).applyQuaternion(this.tmpQuat).normalize();
    const verticalScore = 1 - Math.abs(this.worldNormal.dot(this.worldUp));
    const isLikelyWall = verticalScore > 0.55;

    const cameraPosition = new THREE.Vector3();
    this.camera.getWorldPosition(cameraPosition);
    const distance = cameraPosition.distanceTo(this.tmpPos);
    const wallAngle = Math.round(THREE.MathUtils.radToDeg(Math.acos(Math.min(1, Math.abs(this.worldNormal.dot(this.worldUp))))));

    this.onMetrics(`거리 ${distance.toFixed(2)}m / 벽각 ${wallAngle}°`);

    if (isLikelyWall) {
      this.stableFrames += 1;
      this.onStatus(`벽면 감지 ${Math.min(this.stableFrames, 18)}/18`);
      if (this.stableFrames >= 18) this.placeAutomatically();
    } else {
      this.stableFrames = 0;
      this.onStatus("수직 벽을 비추세요");
    }
  }

  placeAutomatically() {
    this.placed = true;
    this.posterGroup.matrix.copy(this.lastHitMatrix);
    this.posterGroup.visible = true;
    this.reticle.visible = false;
    this.onStatus("자동 배치 완료");
    this.onPlaced();
  }

  reset() {
    this.placed = false;
    this.stableFrames = 0;
    this.posterGroup.visible = false;
    this.onStatus("벽면 자동 탐색 중");
  }

  async replaceProduct(product) {
    this.product = product;
    if (this.posterMesh) {
      this.posterGroup.remove(this.posterMesh);
      this.posterMesh.geometry.dispose();
      this.posterMesh.material.map?.dispose?.();
      this.posterMesh.material.dispose();
    }
    await this.createPoster();
    this.reset();
  }

  capture() {
    const link = document.createElement("a");
    link.download = `auto-wall-ar-${Date.now()}.png`;
    link.href = this.renderer.domElement.toDataURL("image/png");
    link.click();
  }
}

async function start() {
  const capability = await detectCapability();
  if (!capability.immersiveAR) {
    const message = isIOS()
      ? "요구하신 자동 벽면 계산은 카메라 영상만 얹는 방식으로는 만들 수 없습니다.\n\niOS Safari는 WebXR/ARKit plane detection을 웹페이지에 직접 제공하지 않습니다.\n\n이 레포는 Android WebXR에서는 실제 hit-test로 자동 배치하고, iOS까지 웹 링크로 자동 벽면 AR을 하려면 Mattercraft/Zappar/Onirix 같은 WebAR SDK 프로젝트에 이 렌더링 코드를 연결해야 합니다."
      : "이 브라우저는 WebXR immersive-ar를 지원하지 않습니다. Android Chrome 또는 WebAR SDK 연결이 필요합니다.";
    showUnsupported(message);
    return;
  }

  intro.classList.add("hidden");
  arLayer.classList.remove("hidden");

  engine = new WebXRAutoWallEngine({
    host,
    product: selectedProduct,
    onStatus: (text) => { statusText.textContent = text; },
    onMetrics: (text) => { metricText.textContent = text; },
    onPlaced: () => { scanGuide.classList.add("hidden"); }
  });

  try {
    await engine.start();
  } catch (error) {
    console.error(error);
    arLayer.classList.add("hidden");
    intro.classList.remove("hidden");
    showUnsupported(`AR 시작 실패:\n${error.message || error}`);
  }
}

$("startButton").addEventListener("click", start);
$("resetButton").addEventListener("click", () => {
  scanGuide.classList.remove("hidden");
  engine?.reset();
});
$("captureButton").addEventListener("click", () => engine?.capture());
$("replaceButton").addEventListener("click", async () => {
  const idx = PRODUCTS.findIndex((p) => p.id === selectedProduct.id);
  selectedProduct = PRODUCTS[(idx + 1) % PRODUCTS.length];
  scanGuide.classList.remove("hidden");
  await engine?.replaceProduct(selectedProduct);
});
$("closeUnsupported").addEventListener("click", () => unsupported.classList.add("hidden"));

renderProducts();
detectCapability();
