const $ = (id) => document.getElementById(id);

const els = {
  video: $('camera'),
  stage: $('stage'),
  reticle: $('reticle'),
  status: $('status'),
  startCamera: $('startCamera'),
  pickImage: $('pickImage'),
  imageInput: $('imageInput'),
  sizeButton: $('sizeButton'),
  startCalibration: $('startCalibration'),
  calibrationBox: $('calibrationBox'),
  calibrationLabel: $('calibrationLabel'),
  placeMode: $('placeMode'),
  rotateLeft: $('rotateLeft'),
  rotateRight: $('rotateRight'),
  capture: $('capture'),
  reset: $('reset'),
  wallImage: $('wallImage'),
  downloadLink: $('downloadLink'),
};

const state = {
  stream: null,
  imageObjectUrl: null,
  pxPerMeter: null,
  isCalibrating: false,
  isPlaceMode: false,
  realWidthCm: 60,
  realHeightCm: 90,
  knownWidthCm: 21,
  item: {
    x: window.innerWidth / 2,
    y: window.innerHeight * 0.44,
    widthPx: 220,
    heightPx: 330,
    rotationDeg: 0,
    scale: 1,
  },
  itemPointers: new Map(),
  calibrationDrag: null,
};

function setStatus(message) {
  els.status.textContent = message;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getStageRect() {
  return els.stage.getBoundingClientRect();
}

function getActualImageSizePx() {
  const widthM = state.realWidthCm / 100;
  const heightM = state.realHeightCm / 100;

  if (state.pxPerMeter) {
    return {
      widthPx: widthM * state.pxPerMeter,
      heightPx: heightM * state.pxPerMeter,
    };
  }

  const fallbackWidth = clamp(window.innerWidth * 0.38, 150, 280);
  return {
    widthPx: fallbackWidth,
    heightPx: fallbackWidth * (heightM / widthM),
  };
}

function applyActualSizeToItem() {
  const { widthPx, heightPx } = getActualImageSizePx();
  state.item.widthPx = widthPx;
  state.item.heightPx = heightPx;
  state.item.scale = 1;
  renderItem();
}

function renderItem() {
  const item = state.item;
  els.wallImage.style.left = `${item.x}px`;
  els.wallImage.style.top = `${item.y}px`;
  els.wallImage.style.width = `${item.widthPx}px`;
  els.wallImage.style.height = `${item.heightPx}px`;
  els.wallImage.style.transform = `translate(-50%, -50%) rotate(${item.rotationDeg}deg) scale(${item.scale})`;
}

function enableImageControls(enabled) {
  els.sizeButton.disabled = !enabled;
  els.startCalibration.disabled = !enabled;
  els.placeMode.disabled = !enabled;
  els.rotateLeft.disabled = !enabled;
  els.rotateRight.disabled = !enabled;
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

  els.wallImage.src = state.imageObjectUrl;
  els.wallImage.classList.remove('hidden');
  enableImageControls(true);
  applyActualSizeToItem();
  setStatus(`${state.realWidthCm}×${state.realHeightCm}cm · 드래그/핀치 가능`);
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
  applyActualSizeToItem();
  setStatus(`${state.realWidthCm}×${state.realHeightCm}cm 적용`);
}

function togglePlaceMode() {
  if (!state.imageObjectUrl) {
    alert('먼저 이미지를 선택하세요.');
    return;
  }

  state.isPlaceMode = !state.isPlaceMode;
  els.placeMode.classList.toggle('active', state.isPlaceMode);
  els.placeMode.textContent = state.isPlaceMode ? '터치' : '배치';
  els.reticle.classList.toggle('hidden', !state.isPlaceMode);
  setStatus(state.isPlaceMode ? '벽의 원하는 위치를 터치하세요' : '이미지 배치 모드 종료');
}

function placeItemAt(clientX, clientY) {
  const rect = getStageRect();
  state.item.x = clamp(clientX - rect.left, 0, rect.width);
  state.item.y = clamp(clientY - rect.top, 0, rect.height);
  renderItem();
  state.isPlaceMode = false;
  els.placeMode.classList.remove('active');
  els.placeMode.textContent = '배치';
  els.reticle.classList.add('hidden');
  setStatus('이미지 배치 완료 · 이미지를 드래그/핀치하세요');
}

function toggleCalibration() {
  if (!state.imageObjectUrl) {
    alert('먼저 이미지를 선택하세요.');
    return;
  }

  if (!state.isCalibrating) {
    const known = prompt('기준물의 실제 너비(cm)를 입력하세요. A4 짧은 변은 21cm입니다.', String(state.knownWidthCm));
    if (known === null) return;

    const knownCm = Number.parseFloat(known);
    if (!Number.isFinite(knownCm) || knownCm <= 0) {
      alert('기준물 너비를 숫자로 입력해주세요. 예: 21');
      return;
    }

    state.knownWidthCm = knownCm;
    state.isCalibrating = true;
    els.calibrationBox.classList.remove('hidden');
    els.startCalibration.classList.add('active');
    els.startCalibration.textContent = '완료';
    updateCalibrationLabel();
    setStatus('파란 박스를 기준물 너비에 맞춘 뒤 완료를 누르세요');
    return;
  }

  const knownWidthM = state.knownWidthCm / 100;
  const boxWidthPx = els.calibrationBox.getBoundingClientRect().width;
  state.pxPerMeter = boxWidthPx / knownWidthM;
  state.isCalibrating = false;
  els.calibrationBox.classList.add('hidden');
  els.startCalibration.classList.remove('active');
  els.startCalibration.textContent = '보정';
  applyActualSizeToItem();
  setStatus(`보정 완료 · 1m ≈ ${Math.round(state.pxPerMeter)}px`);
}

function updateCalibrationLabel() {
  const boxWidthPx = Math.round(els.calibrationBox.getBoundingClientRect().width);
  els.calibrationLabel.textContent = `${state.knownWidthCm}cm = ${boxWidthPx}px`;
}

function rotateBy(deltaDeg) {
  state.item.rotationDeg = clamp(state.item.rotationDeg + deltaDeg, -180, 180);
  renderItem();
  setStatus(`회전 ${Math.round(state.item.rotationDeg)}°`);
}

function setupCalibrationDrag() {
  const box = els.calibrationBox;
  const minWidth = 60;

  box.addEventListener('pointerdown', (event) => {
    if (!state.isCalibrating) return;
    event.preventDefault();
    event.stopPropagation();

    const target = event.target;
    const rect = box.getBoundingClientRect();
    const mode = target.classList.contains('left')
      ? 'left'
      : target.classList.contains('right')
        ? 'right'
        : 'move';

    state.calibrationDrag = {
      pointerId: event.pointerId,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
      width: rect.width,
    };
    box.setPointerCapture(event.pointerId);
  });

  box.addEventListener('pointermove', (event) => {
    const drag = state.calibrationDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const stage = getStageRect();

    let left = drag.left;
    let top = drag.top;
    let width = drag.width;

    if (drag.mode === 'move') {
      left = clamp(drag.left + dx, 0, stage.width - width);
      top = clamp(drag.top + dy, 0, stage.height - 120);
    } else if (drag.mode === 'left') {
      const newLeft = clamp(drag.left + dx, 0, drag.left + drag.width - minWidth);
      width = drag.width + (drag.left - newLeft);
      left = newLeft;
    } else if (drag.mode === 'right') {
      width = clamp(drag.width + dx, minWidth, stage.width - drag.left);
    }

    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${width}px`;
    updateCalibrationLabel();
  });

  box.addEventListener('pointerup', endCalibrationDrag);
  box.addEventListener('pointercancel', endCalibrationDrag);

  function endCalibrationDrag(event) {
    if (!state.calibrationDrag || state.calibrationDrag.pointerId !== event.pointerId) return;
    state.calibrationDrag = null;
  }
}

function setupItemGestures() {
  const img = els.wallImage;
  let dragStart = null;
  let pinchStart = null;

  img.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    img.setPointerCapture(event.pointerId);
    state.itemPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (state.itemPointers.size === 1) {
      dragStart = {
        pointerId: event.pointerId,
        x: state.item.x,
        y: state.item.y,
        clientX: event.clientX,
        clientY: event.clientY,
      };
    }

    if (state.itemPointers.size === 2) {
      const points = [...state.itemPointers.values()];
      pinchStart = {
        distance: getDistance(points[0], points[1]),
        scale: state.item.scale,
      };
      dragStart = null;
    }
  });

  img.addEventListener('pointermove', (event) => {
    if (!state.itemPointers.has(event.pointerId)) return;
    state.itemPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (state.itemPointers.size === 2 && pinchStart) {
      const points = [...state.itemPointers.values()];
      const nextDistance = getDistance(points[0], points[1]);
      state.item.scale = clamp(pinchStart.scale * (nextDistance / pinchStart.distance), 0.25, 4);
      renderItem();
      return;
    }

    if (dragStart && dragStart.pointerId === event.pointerId) {
      const stage = getStageRect();
      state.item.x = clamp(dragStart.x + event.clientX - dragStart.clientX, 0, stage.width);
      state.item.y = clamp(dragStart.y + event.clientY - dragStart.clientY, 0, stage.height);
      renderItem();
    }
  });

  img.addEventListener('pointerup', endItemPointer);
  img.addEventListener('pointercancel', endItemPointer);

  function endItemPointer(event) {
    state.itemPointers.delete(event.pointerId);
    if (state.itemPointers.size < 2) pinchStart = null;
    if (state.itemPointers.size === 0) dragStart = null;
  }
}

function getDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function handleStagePointerDown(event) {
  if (event.target === els.wallImage || els.calibrationBox.contains(event.target)) return;
  if (!state.isPlaceMode) return;
  placeItemAt(event.clientX, event.clientY);
}

function resetAll() {
  state.pxPerMeter = null;
  state.isCalibrating = false;
  state.isPlaceMode = false;
  state.item.x = window.innerWidth / 2;
  state.item.y = window.innerHeight * 0.44;
  state.item.rotationDeg = 0;
  state.item.scale = 1;
  els.calibrationBox.classList.add('hidden');
  els.startCalibration.classList.remove('active');
  els.startCalibration.textContent = '보정';
  els.placeMode.classList.remove('active');
  els.placeMode.textContent = '배치';
  els.reticle.classList.add('hidden');
  applyActualSizeToItem();
  setStatus(state.stream ? '초기화 완료 · 카메라 실행 중' : '초기화 완료 · 카메라 대기');
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
  canvas.width = Math.floor(width * window.devicePixelRatio);
  canvas.height = Math.floor(height * window.devicePixelRatio);

  const ctx = canvas.getContext('2d');
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

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
      const item = state.item;
      const width = item.widthPx * item.scale;
      const height = item.heightPx * item.scale;

      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.rotate((item.rotationDeg * Math.PI) / 180);
      ctx.shadowColor = 'rgba(0,0,0,.35)';
      ctx.shadowBlur = 22;
      ctx.shadowOffsetY = 14;
      ctx.drawImage(img, -width / 2, -height / 2, width, height);
      ctx.restore();
      resolve();
    };
    img.onerror = () => resolve();
    img.src = state.imageObjectUrl;
  });
}

function bindEvents() {
  els.startCamera.addEventListener('click', startCamera);
  els.pickImage.addEventListener('click', pickImage);
  els.imageInput.addEventListener('change', handleImageInput);
  els.sizeButton.addEventListener('click', editSize);
  els.startCalibration.addEventListener('click', toggleCalibration);
  els.placeMode.addEventListener('click', togglePlaceMode);
  els.rotateLeft.addEventListener('click', () => rotateBy(-5));
  els.rotateRight.addEventListener('click', () => rotateBy(5));
  els.capture.addEventListener('click', capturePreview);
  els.reset.addEventListener('click', resetAll);
  els.stage.addEventListener('pointerdown', handleStagePointerDown);

  window.addEventListener('resize', () => {
    state.item.x = clamp(state.item.x, 0, window.innerWidth);
    state.item.y = clamp(state.item.y, 0, window.innerHeight);
    renderItem();
  });
}

bindEvents();
setupCalibrationDrag();
setupItemGestures();
renderItem();
setStatus('카메라를 누른 뒤 이미지를 선택하세요');
