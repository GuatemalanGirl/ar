const $ = (id) => document.getElementById(id);

const els = {
  video: $('camera'),
  stage: $('stage'),
  status: $('status'),
  startCamera: $('startCamera'),
  pickImage: $('pickImage'),
  imageInput: $('imageInput'),
  sizeButton: $('sizeButton'),
  planeButton: $('planeButton'),
  placeMode: $('placeMode'),
  rotateLeft: $('rotateLeft'),
  rotateRight: $('rotateRight'),
  scaleDown: $('scaleDown'),
  scaleUp: $('scaleUp'),
  capture: $('capture'),
  reset: $('reset'),
  wallImage: $('wallImage'),
  reticle: $('reticle'),
  planeSvg: $('planeSvg'),
  planePolygon: $('planePolygon'),
  planePolyline: $('planePolyline'),
  planePointLayer: $('planePointLayer'),
  hintBadge: $('hintBadge'),
  downloadLink: $('downloadLink'),
};

const state = {
  stream: null,
  imageObjectUrl: null,
  realWidthCm: 60,
  realHeightCm: 90,
  imageElementWidthPx: 420,
  imageElementHeightPx: 630,
  fallback: {
    x: window.innerWidth / 2,
    y: window.innerHeight * 0.45,
  },
  item: {
    centerCm: { x: 10.5, y: 14.85 },
    rotationDeg: 0,
    scale: 1,
  },
  plane: {
    calibrating: false,
    ready: false,
    points: [],
    widthCm: 21,
    heightCm: 29.7,
    H: null,
    invH: null,
    lastAngles: null,
  },
  placeMode: false,
  pointers: new Map(),
};

function setStatus(message) {
  els.status.textContent = message;
}

function showHint(message) {
  els.hintBadge.textContent = message;
  els.hintBadge.classList.remove('hidden');
}

function hideHint() {
  els.hintBadge.classList.add('hidden');
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function deg(rad) {
  return (rad * 180) / Math.PI;
}

function getStagePoint(event) {
  const rect = els.stage.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function enableImageControls(enabled) {
  els.sizeButton.disabled = !enabled;
  els.planeButton.disabled = !enabled;
  els.placeMode.disabled = !enabled;
  els.rotateLeft.disabled = !enabled;
  els.rotateRight.disabled = !enabled;
  els.scaleDown.disabled = !enabled;
  els.scaleUp.disabled = !enabled;
  els.capture.disabled = !enabled || !state.stream;
}

async function startCamera() {
  try {
    if (state.stream) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      alert('이 브라우저는 카메라 API를 지원하지 않습니다. iPhone은 Safari, Android는 Chrome으로 열어주세요.');
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });

    state.stream = stream;
    els.video.srcObject = stream;
    await els.video.play();

    setStatus('카메라 실행 중 · 이미지를 선택하세요');
    els.startCamera.textContent = '실행중';
    els.startCamera.disabled = true;
    els.capture.disabled = !state.imageObjectUrl;
  } catch (error) {
    console.error(error);
    setStatus('카메라 권한 실패');
    alert('카메라를 시작할 수 없습니다. GitHub Pages HTTPS 주소인지, 브라우저 카메라 권한이 허용됐는지 확인하세요.');
  }
}

function pickImage() {
  els.imageInput.click();
}

function handleImageInput(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (state.imageObjectUrl) URL.revokeObjectURL(state.imageObjectUrl);
  state.imageObjectUrl = URL.createObjectURL(file);

  els.wallImage.onload = () => {
    refreshImageElementSize();
    renderItem();
  };
  els.wallImage.src = state.imageObjectUrl;
  els.wallImage.classList.remove('hidden');
  enableImageControls(true);
  setStatus(`${state.realWidthCm}×${state.realHeightCm}cm · 먼저 “벽면”으로 4점을 찍으세요`);
}

function editSize() {
  const width = prompt('이미지 실제 가로(cm)를 입력하세요.', String(state.realWidthCm));
  if (width === null) return;

  const height = prompt('이미지 실제 세로(cm)를 입력하세요.', String(state.realHeightCm));
  if (height === null) return;

  const widthCm = Number.parseFloat(width);
  const heightCm = Number.parseFloat(height);
  if (!Number.isFinite(widthCm) || !Number.isFinite(heightCm) || widthCm <= 0 || heightCm <= 0) {
    alert('가로/세로를 숫자로 입력해주세요. 예: 60, 90');
    return;
  }

  state.realWidthCm = widthCm;
  state.realHeightCm = heightCm;
  refreshImageElementSize();
  renderItem();
  setStatus(`${widthCm}×${heightCm}cm 적용`);
}

function refreshImageElementSize() {
  const maxBase = Math.max(window.innerWidth, window.innerHeight);
  const widthPx = clamp(maxBase * 0.42, 260, 760);
  state.imageElementWidthPx = widthPx;
  state.imageElementHeightPx = widthPx * (state.realHeightCm / state.realWidthCm);
  els.wallImage.style.width = `${state.imageElementWidthPx}px`;
  els.wallImage.style.height = `${state.imageElementHeightPx}px`;
}

function startPlaneCalibration() {
  if (!state.imageObjectUrl) {
    alert('먼저 이미지를 선택하세요.');
    return;
  }

  const width = prompt('벽에 붙인 기준 사각형의 실제 가로(cm)를 입력하세요. A4 짧은 변은 21cm입니다.', String(state.plane.widthCm));
  if (width === null) return;
  const height = prompt('기준 사각형의 실제 세로(cm)를 입력하세요. A4 긴 변은 29.7cm입니다.', String(state.plane.heightCm));
  if (height === null) return;

  const widthCm = Number.parseFloat(width);
  const heightCm = Number.parseFloat(height);
  if (!Number.isFinite(widthCm) || !Number.isFinite(heightCm) || widthCm <= 0 || heightCm <= 0) {
    alert('기준 사각형 크기를 숫자로 입력해주세요. 예: 21, 29.7');
    return;
  }

  state.plane.widthCm = widthCm;
  state.plane.heightCm = heightCm;
  state.plane.points = [];
  state.plane.ready = false;
  state.plane.calibrating = true;
  state.plane.H = null;
  state.plane.invH = null;
  state.plane.lastAngles = null;

  els.planeButton.classList.add('active');
  els.planeButton.textContent = '찍는중';
  els.placeMode.classList.remove('active');
  state.placeMode = false;
  els.reticle.classList.add('hidden');
  els.wallImage.classList.add('hidden');
  renderPlaneOverlay();
  showHint('기준 사각형 모서리를 순서대로 터치: 좌상 → 우상 → 우하 → 좌하');
  setStatus('벽면 보정: 1/4 좌상단 모서리를 터치하세요');
}

function addPlanePoint(point) {
  if (!state.plane.calibrating) return;
  state.plane.points.push(point);
  renderPlaneOverlay();

  const labels = ['우상단', '우하단', '좌하단'];
  const count = state.plane.points.length;

  if (count < 4) {
    setStatus(`벽면 보정: ${count + 1}/4 ${labels[count - 1]} 모서리를 터치하세요`);
    return;
  }

  finishPlaneCalibration();
}

function finishPlaneCalibration() {
  const dst = state.plane.points;
  const src = [
    { x: 0, y: 0 },
    { x: state.plane.widthCm, y: 0 },
    { x: state.plane.widthCm, y: state.plane.heightCm },
    { x: 0, y: state.plane.heightCm },
  ];

  try {
    const H = computeHomography(src, dst);
    const invH = invertHomography(H);
    state.plane.H = H;
    state.plane.invH = invH;
    state.plane.ready = true;
    state.plane.calibrating = false;
    state.item.centerCm = {
      x: state.plane.widthCm / 2,
      y: state.plane.heightCm / 2,
    };

    els.planeButton.classList.remove('active');
    els.planeButton.textContent = '벽면';
    els.wallImage.classList.remove('hidden');
    hideHint();
    state.plane.lastAngles = estimatePlaneAngles();
    renderPlaneOverlay();
    renderItem();
    setStatus(makePlaneStatus('벽면 보정 완료'));
  } catch (error) {
    console.error(error);
    alert('벽면 계산에 실패했습니다. 4점을 좌상→우상→우하→좌하 순서로 다시 찍어주세요.');
    resetPlaneOnly();
  }
}

function renderPlaneOverlay() {
  const pts = state.plane.points;
  const pointString = pts.map((p) => `${p.x},${p.y}`).join(' ');
  els.planePolygon.setAttribute('points', pts.length === 4 ? pointString : '');
  els.planePolyline.setAttribute('points', pts.length > 1 ? `${pointString}${pts.length === 4 ? ` ${pts[0].x},${pts[0].y}` : ''}` : '');

  els.planePointLayer.innerHTML = '';
  pts.forEach((p, index) => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('class', 'plane-point');
    circle.setAttribute('cx', p.x);
    circle.setAttribute('cy', p.y);
    circle.setAttribute('r', '8');
    els.planePointLayer.appendChild(circle);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('class', 'plane-point-label');
    label.setAttribute('x', p.x + 12);
    label.setAttribute('y', p.y - 10);
    label.textContent = String(index + 1);
    els.planePointLayer.appendChild(label);
  });
}

function resetPlaneOnly() {
  state.plane.calibrating = false;
  state.plane.ready = false;
  state.plane.points = [];
  state.plane.H = null;
  state.plane.invH = null;
  state.plane.lastAngles = null;
  els.planeButton.classList.remove('active');
  els.planeButton.textContent = '벽면';
  hideHint();
  renderPlaneOverlay();
  els.wallImage.classList.toggle('hidden', !state.imageObjectUrl);
}

function togglePlaceMode() {
  if (!state.imageObjectUrl) {
    alert('먼저 이미지를 선택하세요.');
    return;
  }

  state.placeMode = !state.placeMode;
  els.placeMode.classList.toggle('active', state.placeMode);
  els.placeMode.textContent = state.placeMode ? '터치' : '배치';
  els.reticle.classList.toggle('hidden', !state.placeMode);
  showHint(state.placeMode ? '벽의 원하는 위치를 터치하면 이미지 중심이 그곳으로 이동합니다.' : '');
  if (!state.placeMode) hideHint();
  setStatus(state.placeMode ? '배치 모드 · 원하는 위치를 터치하세요' : '배치 모드 종료');
}

function placeItemAt(point) {
  if (state.plane.ready) {
    const planePoint = mapPoint(state.plane.invH, point.x, point.y);
    state.item.centerCm = planePoint;
    setStatus(makePlaneStatus('벽면 좌표에 배치'));
  } else {
    state.fallback.x = point.x;
    state.fallback.y = point.y;
    setStatus('단순 화면 배치 완료 · “벽면”을 찍으면 원근 보정됩니다');
  }

  state.placeMode = false;
  els.placeMode.classList.remove('active');
  els.placeMode.textContent = '배치';
  els.reticle.classList.add('hidden');
  hideHint();
  renderItem();
}

function rotateBy(deltaDeg) {
  state.item.rotationDeg = normalizeAngle(state.item.rotationDeg + deltaDeg);
  renderItem();
  setStatus(state.plane.ready ? makePlaneStatus(`벽면 내 회전 ${Math.round(state.item.rotationDeg)}°`) : `회전 ${Math.round(state.item.rotationDeg)}°`);
}

function scaleBy(factor) {
  state.item.scale = clamp(state.item.scale * factor, 0.1, 8);
  renderItem();
  setStatus(`스케일 ${state.item.scale.toFixed(2)}×`);
}

function normalizeAngle(angle) {
  let next = angle;
  while (next > 180) next -= 360;
  while (next < -180) next += 360;
  return next;
}

function renderItem() {
  if (!state.imageObjectUrl) return;

  if (state.plane.ready) {
    renderItemOnPlane();
    return;
  }

  const w = state.imageElementWidthPx * state.item.scale;
  const h = state.imageElementHeightPx * state.item.scale;
  els.wallImage.style.width = `${w}px`;
  els.wallImage.style.height = `${h}px`;
  els.wallImage.style.left = `${state.fallback.x - w / 2}px`;
  els.wallImage.style.top = `${state.fallback.y - h / 2}px`;
  els.wallImage.style.transform = `rotate(${state.item.rotationDeg}deg)`;
  els.wallImage.style.transformOrigin = '50% 50%';
}

function renderItemOnPlane() {
  const displayW = state.imageElementWidthPx;
  const displayH = state.imageElementHeightPx;
  els.wallImage.style.width = `${displayW}px`;
  els.wallImage.style.height = `${displayH}px`;
  els.wallImage.style.left = '0px';
  els.wallImage.style.top = '0px';
  els.wallImage.style.transformOrigin = '0 0';

  const quad = getImageScreenQuad();
  const src = [
    { x: 0, y: 0 },
    { x: displayW, y: 0 },
    { x: displayW, y: displayH },
    { x: 0, y: displayH },
  ];
  const Hcss = computeHomography(src, quad);
  els.wallImage.style.transform = homographyToCssMatrix3d(Hcss);
}

function getImagePlaneCorners() {
  const widthCm = state.realWidthCm * state.item.scale;
  const heightCm = state.realHeightCm * state.item.scale;
  const cx = state.item.centerCm.x;
  const cy = state.item.centerCm.y;
  const a = (state.item.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);

  const local = [
    { x: -widthCm / 2, y: -heightCm / 2 },
    { x: widthCm / 2, y: -heightCm / 2 },
    { x: widthCm / 2, y: heightCm / 2 },
    { x: -widthCm / 2, y: heightCm / 2 },
  ];

  return local.map((p) => ({
    x: cx + p.x * cos - p.y * sin,
    y: cy + p.x * sin + p.y * cos,
  }));
}

function getImageScreenQuad() {
  return getImagePlaneCorners().map((p) => mapPoint(state.plane.H, p.x, p.y));
}

function estimatePlaneAngles() {
  if (!state.plane.ready || !state.plane.H) return null;

  const pts = state.plane.points;
  const top = angleBetween(pts[0], pts[1]);
  const right = angleBetween(pts[1], pts[2]);
  const topLen = distance(pts[0], pts[1]);
  const bottomLen = distance(pts[3], pts[2]);
  const leftLen = distance(pts[0], pts[3]);
  const rightLen = distance(pts[1], pts[2]);
  const perspectiveX = topLen / Math.max(bottomLen, 0.0001);
  const perspectiveY = leftLen / Math.max(rightLen, 0.0001);

  const pose = estimatePoseFromHomography(state.plane.H);

  return {
    screenTopDeg: top,
    screenRightDeg: right,
    perspectiveX,
    perspectiveY,
    yawDeg: pose?.yawDeg ?? null,
    pitchDeg: pose?.pitchDeg ?? null,
    facingDeg: pose?.facingDeg ?? null,
  };
}

function makePlaneStatus(prefix) {
  const a = state.plane.lastAngles || estimatePlaneAngles();
  if (!a) return prefix;

  const screen = `화면기울기 ${Math.round(a.screenTopDeg)}°`;
  const perspective = `원근 ${a.perspectiveX.toFixed(2)}:${a.perspectiveY.toFixed(2)}`;
  const pose = Number.isFinite(a.facingDeg)
    ? `추정각 ${Math.round(a.facingDeg)}°`
    : '추정각 -';
  return `${prefix} · ${screen} · ${perspective} · ${pose}`;
}

function angleBetween(a, b) {
  return deg(Math.atan2(b.y - a.y, b.x - a.x));
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function handleStagePointerDown(event) {
  if (event.target === els.wallImage) return;
  const point = getStagePoint(event);

  if (state.plane.calibrating) {
    addPlanePoint(point);
    return;
  }

  if (state.placeMode) {
    placeItemAt(point);
  }
}

function setupItemGestures() {
  let dragStart = null;
  let pinchStart = null;

  els.wallImage.addEventListener('pointerdown', (event) => {
    if (!state.imageObjectUrl) return;
    event.preventDefault();
    event.stopPropagation();
    els.wallImage.setPointerCapture(event.pointerId);
    state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (state.pointers.size === 1) {
      dragStart = {
        pointerId: event.pointerId,
        screenStart: { x: event.clientX, y: event.clientY },
        fallbackStart: { ...state.fallback },
        planeStart: { ...state.item.centerCm },
      };
      pinchStart = null;
    }

    if (state.pointers.size === 2) {
      const points = [...state.pointers.values()];
      pinchStart = {
        distance: distance(points[0], points[1]),
        scale: state.item.scale,
      };
      dragStart = null;
    }
  });

  els.wallImage.addEventListener('pointermove', (event) => {
    if (!state.pointers.has(event.pointerId)) return;
    event.preventDefault();
    state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (state.pointers.size === 2 && pinchStart) {
      const points = [...state.pointers.values()];
      const nextDistance = distance(points[0], points[1]);
      state.item.scale = clamp(pinchStart.scale * (nextDistance / Math.max(pinchStart.distance, 1)), 0.1, 8);
      renderItem();
      return;
    }

    if (!dragStart || dragStart.pointerId !== event.pointerId) return;

    const dx = event.clientX - dragStart.screenStart.x;
    const dy = event.clientY - dragStart.screenStart.y;

    if (state.plane.ready) {
      const startScreen = mapPoint(state.plane.H, dragStart.planeStart.x, dragStart.planeStart.y);
      const nextPlane = mapPoint(state.plane.invH, startScreen.x + dx, startScreen.y + dy);
      state.item.centerCm = nextPlane;
    } else {
      state.fallback.x = clamp(dragStart.fallbackStart.x + dx, 0, window.innerWidth);
      state.fallback.y = clamp(dragStart.fallbackStart.y + dy, 0, window.innerHeight);
    }

    renderItem();
  });

  els.wallImage.addEventListener('pointerup', endPointer);
  els.wallImage.addEventListener('pointercancel', endPointer);

  function endPointer(event) {
    state.pointers.delete(event.pointerId);
    if (state.pointers.size < 2) pinchStart = null;
    if (state.pointers.size === 0) dragStart = null;
  }
}

function resetAll() {
  state.placeMode = false;
  state.item.rotationDeg = 0;
  state.item.scale = 1;
  state.fallback = {
    x: window.innerWidth / 2,
    y: window.innerHeight * 0.45,
  };
  resetPlaneOnly();
  els.placeMode.classList.remove('active');
  els.placeMode.textContent = '배치';
  els.reticle.classList.add('hidden');
  renderItem();
  setStatus(state.stream ? '초기화 완료 · “벽면”으로 다시 보정하세요' : '초기화 완료 · 카메라 대기');
}

async function capturePreview() {
  if (!state.stream) {
    alert('먼저 카메라를 시작하세요.');
    return;
  }
  if (!state.imageObjectUrl) {
    alert('먼저 이미지를 선택하세요.');
    return;
  }

  const canvas = document.createElement('canvas');
  const width = window.innerWidth;
  const height = window.innerHeight;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);

  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);

  drawVideoCover(ctx, els.video, width, height);
  await drawPlacedImage(ctx);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    els.downloadLink.href = url;
    els.downloadLink.classList.remove('hidden');
    els.downloadLink.textContent = '캡처 다운로드';
    setTimeout(() => els.downloadLink.classList.add('hidden'), 7000);
  }, 'image/png', 0.95);
}

function drawVideoCover(ctx, video, canvasW, canvasH) {
  const videoW = video.videoWidth || canvasW;
  const videoH = video.videoHeight || canvasH;
  const videoRatio = videoW / videoH;
  const canvasRatio = canvasW / canvasH;

  let sx = 0;
  let sy = 0;
  let sw = videoW;
  let sh = videoH;

  if (videoRatio > canvasRatio) {
    sw = videoH * canvasRatio;
    sx = (videoW - sw) / 2;
  } else {
    sh = videoW / canvasRatio;
    sy = (videoH - sh) / 2;
  }

  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvasW, canvasH);
}

function drawPlacedImage(ctx) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (state.plane.ready) {
        drawWarpedImage(ctx, img);
      } else {
        const width = state.imageElementWidthPx * state.item.scale;
        const height = state.imageElementHeightPx * state.item.scale;
        ctx.save();
        ctx.translate(state.fallback.x, state.fallback.y);
        ctx.rotate((state.item.rotationDeg * Math.PI) / 180);
        ctx.shadowColor = 'rgba(0,0,0,.35)';
        ctx.shadowBlur = 22;
        ctx.shadowOffsetY = 14;
        ctx.drawImage(img, -width / 2, -height / 2, width, height);
        ctx.restore();
      }
      resolve();
    };
    img.onerror = () => resolve();
    img.src = state.imageObjectUrl;
  });
}

function drawWarpedImage(ctx, img) {
  const displayW = state.imageElementWidthPx;
  const displayH = state.imageElementHeightPx;
  const quad = getImageScreenQuad();
  const Hcss = computeHomography([
    { x: 0, y: 0 },
    { x: displayW, y: 0 },
    { x: displayW, y: displayH },
    { x: 0, y: displayH },
  ], quad);

  const grid = 28;
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      const x0 = (x / grid) * displayW;
      const x1 = ((x + 1) / grid) * displayW;
      const y0 = (y / grid) * displayH;
      const y1 = ((y + 1) / grid) * displayH;

      const s00 = { x: (x0 / displayW) * img.naturalWidth, y: (y0 / displayH) * img.naturalHeight };
      const s10 = { x: (x1 / displayW) * img.naturalWidth, y: (y0 / displayH) * img.naturalHeight };
      const s11 = { x: (x1 / displayW) * img.naturalWidth, y: (y1 / displayH) * img.naturalHeight };
      const s01 = { x: (x0 / displayW) * img.naturalWidth, y: (y1 / displayH) * img.naturalHeight };

      const d00 = mapPoint(Hcss, x0, y0);
      const d10 = mapPoint(Hcss, x1, y0);
      const d11 = mapPoint(Hcss, x1, y1);
      const d01 = mapPoint(Hcss, x0, y1);

      drawTexturedTriangle(ctx, img, s00, s10, s11, d00, d10, d11);
      drawTexturedTriangle(ctx, img, s00, s11, s01, d00, d11, d01);
    }
  }
}

function drawTexturedTriangle(ctx, img, s0, s1, s2, d0, d1, d2) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y);
  ctx.lineTo(d1.x, d1.y);
  ctx.lineTo(d2.x, d2.y);
  ctx.closePath();
  ctx.clip();

  const denom = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
  if (Math.abs(denom) < 1e-6) {
    ctx.restore();
    return;
  }

  const a = (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / denom;
  const c = (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / denom;
  const e = (d0.x * (s1.x * s2.y - s2.x * s1.y) + d1.x * (s2.x * s0.y - s0.x * s2.y) + d2.x * (s0.x * s1.y - s1.x * s0.y)) / denom;

  const b = (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / denom;
  const d = (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / denom;
  const f = (d0.y * (s1.x * s2.y - s2.x * s1.y) + d1.y * (s2.x * s0.y - s0.x * s2.y) + d2.y * (s0.x * s1.y - s1.x * s0.y)) / denom;

  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

function computeHomography(src, dst) {
  const A = [];
  const b = [];

  for (let i = 0; i < 4; i++) {
    const x = src[i].x;
    const y = src[i].y;
    const u = dst[i].x;
    const v = dst[i].y;

    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }

  const h = solveLinearSystem(A, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

function solveLinearSystem(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[pivot][col])) pivot = row;
    }

    if (Math.abs(M[pivot][col]) < 1e-10) throw new Error('Singular matrix');
    [M[col], M[pivot]] = [M[pivot], M[col]];

    const div = M[col][col];
    for (let k = col; k <= n; k++) M[col][k] /= div;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col];
      for (let k = col; k <= n; k++) M[row][k] -= factor * M[col][k];
    }
  }

  return M.map((row) => row[n]);
}

function mapPoint(H, x, y) {
  const w = H[6] * x + H[7] * y + H[8];
  return {
    x: (H[0] * x + H[1] * y + H[2]) / w,
    y: (H[3] * x + H[4] * y + H[5]) / w,
  };
}

function invertHomography(H) {
  const [a, b, c, d, e, f, g, h, i] = H;
  const A = e * i - f * h;
  const B = c * h - b * i;
  const C = b * f - c * e;
  const D = f * g - d * i;
  const E = a * i - c * g;
  const F = c * d - a * f;
  const G = d * h - e * g;
  const I = a * e - b * d;
  const det = a * A + b * D + c * G;
  if (Math.abs(det) < 1e-10) throw new Error('Non-invertible homography');
  return [A / det, B / det, C / det, D / det, E / det, F / det, G / det, (b * g - a * h) / det, I / det];
}

function homographyToCssMatrix3d(H) {
  const m11 = H[0];
  const m12 = H[3];
  const m13 = 0;
  const m14 = H[6];

  const m21 = H[1];
  const m22 = H[4];
  const m23 = 0;
  const m24 = H[7];

  const m31 = 0;
  const m32 = 0;
  const m33 = 1;
  const m34 = 0;

  const m41 = H[2];
  const m42 = H[5];
  const m43 = 0;
  const m44 = H[8];

  return `matrix3d(${[
    m11, m12, m13, m14,
    m21, m22, m23, m24,
    m31, m32, m33, m34,
    m41, m42, m43, m44,
  ].map((n) => Number.isFinite(n) ? n.toFixed(10) : 0).join(',')})`;
}

function estimatePoseFromHomography(H) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const fovDeg = 60;
  const fx = w / (2 * Math.tan((fovDeg * Math.PI / 180) / 2));
  const fy = fx;
  const cx = w / 2;
  const cy = h / 2;

  // K^-1 * H. Web cameras do not expose true intrinsics in Safari/Chrome,
  // so this is an approximate pose estimate, not a metrology-grade measurement.
  const col1 = normalizeCameraColumn(H[0], H[3], H[6], fx, fy, cx, cy);
  const col2 = normalizeCameraColumn(H[1], H[4], H[7], fx, fy, cx, cy);

  const scale = 1 / Math.sqrt(Math.max(length3(col1) * length3(col2), 1e-12));
  const r1 = scale3(col1, scale);
  const r2 = scale3(col2, scale);
  let n = cross3(r1, r2);
  n = normalize3(n);
  if (n[2] < 0) n = scale3(n, -1);

  const yawDeg = deg(Math.atan2(n[0], n[2]));
  const pitchDeg = deg(Math.atan2(-n[1], Math.hypot(n[0], n[2])));
  const facingDeg = deg(Math.acos(clamp(Math.abs(n[2]), -1, 1)));

  return { yawDeg, pitchDeg, facingDeg };
}

function normalizeCameraColumn(x, y, z, fx, fy, cx, cy) {
  return [
    (x - cx * z) / fx,
    (y - cy * z) / fy,
    z,
  ];
}

function length3(v) {
  return Math.hypot(v[0], v[1], v[2]);
}

function scale3(v, s) {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize3(v) {
  const len = length3(v) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function bindEvents() {
  els.startCamera.addEventListener('click', startCamera);
  els.pickImage.addEventListener('click', pickImage);
  els.imageInput.addEventListener('change', handleImageInput);
  els.sizeButton.addEventListener('click', editSize);
  els.planeButton.addEventListener('click', startPlaneCalibration);
  els.placeMode.addEventListener('click', togglePlaceMode);
  els.rotateLeft.addEventListener('click', () => rotateBy(-5));
  els.rotateRight.addEventListener('click', () => rotateBy(5));
  els.scaleDown.addEventListener('click', () => scaleBy(0.9));
  els.scaleUp.addEventListener('click', () => scaleBy(1.1));
  els.capture.addEventListener('click', capturePreview);
  els.reset.addEventListener('click', resetAll);
  els.stage.addEventListener('pointerdown', handleStagePointerDown);

  window.addEventListener('resize', () => {
    refreshImageElementSize();
    renderItem();
  });
}

bindEvents();
setupItemGestures();
refreshImageElementSize();
renderPlaneOverlay();
setStatus('카메라 → 이미지 → 크기 → 벽면 4점 → 배치 순서로 진행하세요');
