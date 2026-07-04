const $ = (id) => document.getElementById(id);

const els = {
  video: $('camera'),
  stage: $('stage'),
  reticle: $('reticle'),
  panel: $('panel'),
  panelBody: $('panelBody'),
  togglePanel: $('togglePanel'),
  openPanel: $('openPanel'),
  status: $('status'),
  startCamera: $('startCamera'),
  capture: $('capture'),
  imageInput: $('imageInput'),
  realWidth: $('realWidth'),
  realHeight: $('realHeight'),
  knownWidth: $('knownWidth'),
  startCalibration: $('startCalibration'),
  calibrationBox: $('calibrationBox'),
  calibrationLabel: $('calibrationLabel'),
  calibrationStatus: $('calibrationStatus'),
  placeMode: $('placeMode'),
  fitActual: $('fitActual'),
  wallImage: $('wallImage'),
  rotation: $('rotation'),
  rotationValue: $('rotationValue'),
  requestMotion: $('requestMotion'),
  motionReadout: $('motionReadout'),
  reset: $('reset'),
  downloadLink: $('downloadLink'),
};

const state = {
  stream: null,
  imageObjectUrl: null,
  pxPerMeter: null,
  isCalibrating: false,
  isPlaceMode: false,
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

function closePanel() {
  els.panel.classList.add('panel-closed');
  els.openPanel.classList.remove('hidden');
}

function openPanel() {
  els.panel.classList.remove('panel-closed');
  els.openPanel.classList.add('hidden');
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getMetersFromCmInput(input) {
  const cm = Number.parseFloat(input.value);
  if (!Number.isFinite(cm) || cm <= 0) return null;
  return cm / 100;
}

function getStageRect() {
  return els.stage.getBoundingClientRect();
}

function getActualImageSizePx() {
  const widthM = getMetersFromCmInput(els.realWidth);
  const heightM = getMetersFromCmInput(els.realHeight);

  if (!widthM || !heightM) {
    return { widthPx: 220, heightPx: 330 };
  }

  if (state.pxPerMeter) {
    return {
      widthPx: widthM * state.pxPerMeter,
      heightPx: heightM * state.pxPerMeter,
    };
  }

  const fallbackWidth = clamp(window.innerWidth * 0.38, 160, 280);
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

function enablePlacementControls(enabled) {
  els.placeMode.disabled = !enabled;
  els.fitActual.disabled = !enabled;
  els.capture.disabled = !enabled;
}

async function startCamera() {
  try {
    if (state.stream) return;

    const constraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    state.stream = stream;
    els.video.srcObject = stream;
    await els.video.play();

    setStatus('카메라 실행 중');
    els.startCamera.textContent = '카메라 실행됨';
    els.startCamera.disabled = true;
    els.capture.disabled = !state.imageObjectUrl;
  } catch (error) {
    console.error(error);
    setStatus('카메라 권한 실패');
    alert('카메라를 시작할 수 없습니다. HTTPS 또는 localhost에서 실행 중인지, 카메라 권한이 허용됐는지 확인하세요.');
  }
}

function handleImageInput(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (state.imageObjectUrl) URL.revokeObjectURL(state.imageObjectUrl);
  state.imageObjectUrl = URL.createObjectURL(file);

  els.wallImage.src = state.imageObjectUrl;
  els.wallImage.classList.remove('hidden');
  enablePlacementControls(true);
  applyActualSizeToItem();
  setStatus('이미지 준비 완료');
}

function togglePlaceMode() {
  state.isPlaceMode = !state.isPlaceMode;
  els.placeMode.classList.toggle('active', state.isPlaceMode);
  els.placeMode.textContent = state.isPlaceMode ? '배치 위치 선택 중' : '벽에 배치';
  els.reticle.classList.toggle('hidden', !state.isPlaceMode);
  setStatus(state.isPlaceMode ? '벽 위치를 터치하세요' : '이미지 배치됨');
  if (state.isPlaceMode) closePanel();
}

function placeItemAt(clientX, clientY) {
  const rect = getStageRect();
  state.item.x = clamp(clientX - rect.left, 0, rect.width);
  state.item.y = clamp(clientY - rect.top, 0, rect.height);
  renderItem();
  state.isPlaceMode = false;
  els.placeMode.classList.remove('active');
  els.placeMode.textContent = '벽에 배치';
  els.reticle.classList.add('hidden');
  setStatus('이미지 배치 완료');
}

function startCalibration() {
  state.isCalibrating = !state.isCalibrating;
  els.calibrationBox.classList.toggle('hidden', !state.isCalibrating);
  els.startCalibration.classList.toggle('active', state.isCalibrating);

  if (state.isCalibrating) {
    els.startCalibration.textContent = '보정 완료';
    updateCalibrationLabel();
    setStatus('기준물에 박스 너비를 맞추세요');
    return;
  }

  const knownWidthM = getMetersFromCmInput(els.knownWidth);
  if (!knownWidthM) {
    alert('기준물 너비를 cm 단위로 입력하세요. 예: A4 세로 방향 너비 21cm');
    return;
  }

  const boxWidthPx = els.calibrationBox.getBoundingClientRect().width;
  state.pxPerMeter = boxWidthPx / knownWidthM;
  els.calibrationStatus.textContent = `보정 완료: 1m ≈ ${Math.round(state.pxPerMeter)}px. 같은 거리의 벽에서 실제 크기가 맞습니다.`;
  els.startCalibration.textContent = 'A4/기준물 보정';
  setStatus('스케일 보정 완료');
  applyActualSizeToItem();
}

function updateCalibrationLabel() {
  const boxWidthPx = Math.round(els.calibrationBox.getBoundingClientRect().width);
  const knownCm = Number.parseFloat(els.knownWidth.value || '0');
  els.calibrationLabel.textContent = `${knownCm || '?'}cm = ${boxWidthPx}px`;
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
  if (els.panel.contains(event.target)) return;
  if (event.target === els.wallImage || els.calibrationBox.contains(event.target)) return;
  if (!state.isPlaceMode) return;
  placeItemAt(event.clientX, event.clientY);
}

function handleRotationInput() {
  state.item.rotationDeg = Number.parseFloat(els.rotation.value) || 0;
  els.rotationValue.textContent = `${state.item.rotationDeg}°`;
  renderItem();
}

async function requestMotionPermission() {
  try {
    const anyDeviceOrientation = window.DeviceOrientationEvent;
    if (anyDeviceOrientation && typeof anyDeviceOrientation.requestPermission === 'function') {
      const permission = await anyDeviceOrientation.requestPermission();
      if (permission !== 'granted') {
        els.motionReadout.textContent = '센서: 권한 거부';
        return;
      }
    }

    window.addEventListener('deviceorientation', (event) => {
      const beta = event.beta == null ? '-' : `${event.beta.toFixed(1)}°`;   // front/back tilt
      const gamma = event.gamma == null ? '-' : `${event.gamma.toFixed(1)}°`; // left/right tilt
      const alpha = event.alpha == null ? '-' : `${event.alpha.toFixed(1)}°`; // compass-like heading
      els.motionReadout.textContent = `센서: alpha ${alpha}, beta ${beta}, gamma ${gamma}`;
    }, true);

    els.requestMotion.disabled = true;
    els.requestMotion.textContent = '센서 허용됨';
  } catch (error) {
    console.error(error);
    els.motionReadout.textContent = '센서: 사용할 수 없음';
  }
}

function resetAll() {
  state.pxPerMeter = null;
  state.item.x = window.innerWidth / 2;
  state.item.y = window.innerHeight * 0.44;
  state.item.rotationDeg = 0;
  state.item.scale = 1;
  els.rotation.value = '0';
  els.rotationValue.textContent = '0°';
  els.calibrationStatus.textContent = '보정 전: 화면 기준 임시 크기로 표시됩니다.';
  state.isPlaceMode = false;
  els.placeMode.classList.remove('active');
  els.reticle.classList.add('hidden');
  applyActualSizeToItem();
  setStatus(state.stream ? '카메라 실행 중' : '카메라 대기');
}

async function capturePreview() {
  if (!state.stream || !state.imageObjectUrl) return;

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
  els.imageInput.addEventListener('change', handleImageInput);
  els.startCalibration.addEventListener('click', startCalibration);
  els.knownWidth.addEventListener('input', updateCalibrationLabel);
  els.placeMode.addEventListener('click', togglePlaceMode);
  els.fitActual.addEventListener('click', applyActualSizeToItem);
  els.realWidth.addEventListener('input', applyActualSizeToItem);
  els.realHeight.addEventListener('input', applyActualSizeToItem);
  els.rotation.addEventListener('input', handleRotationInput);
  els.requestMotion.addEventListener('click', requestMotionPermission);
  els.reset.addEventListener('click', resetAll);
  els.capture.addEventListener('click', capturePreview);
  els.togglePanel.addEventListener('click', closePanel);
  els.openPanel.addEventListener('click', openPanel);
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
setStatus('카메라 대기');
