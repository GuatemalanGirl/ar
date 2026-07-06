/* global AFRAME, THREE, XR8 */

const $ = (id) => document.getElementById(id)

const setStatus = (text) => {
  const el = $('status')
  if (el) el.textContent = text
}

const getProductById = (id) => {
  const list = window.WALL_AR_PRODUCTS || []
  return list.find((p) => p.id === id) || list[0]
}

const getSelectedProduct = () => {
  const selected = document.querySelector('.product.selected')
  return getProductById(selected?.dataset.productId)
}

const createBorder = (entity, product) => {
  const parent = $('posterBorder')
  if (!parent || !entity || !product) return

  parent.innerHTML = ''

  const thickness = 0.012
  const w = product.widthM
  const h = product.heightM

  const parts = [
    {pos: `0 ${h / 2} 0.003`, scale: `${w + thickness} ${thickness} ${thickness}`},
    {pos: `0 ${-h / 2} 0.003`, scale: `${w + thickness} ${thickness} ${thickness}`},
    {pos: `${-w / 2} 0 0.003`, scale: `${thickness} ${h + thickness} ${thickness}`},
    {pos: `${w / 2} 0 0.003`, scale: `${thickness} ${h + thickness} ${thickness}`},
  ]

  parts.forEach((p) => {
    const edge = document.createElement('a-box')
    edge.setAttribute('position', p.pos)
    edge.setAttribute('scale', p.scale)
    edge.setAttribute('material', 'shader: flat; color: #00e7ff; opacity: 0.95')
    parent.appendChild(edge)
  })

  parent.object3D.position.copy(entity.object3D.position)
  parent.object3D.quaternion.copy(entity.object3D.quaternion)
}

const applyProduct = (product) => {
  const plane = $('posterPlane')
  const border = $('posterBorder')
  if (!plane || !product) return

  plane.setAttribute('width', product.widthM)
  plane.setAttribute('height', product.heightM)
  plane.setAttribute('material', `shader: flat; side: double; transparent: true; src: #${product.imageAssetId}`)

  if (border) createBorder(plane, product)
}

const cameraWorld = (cameraEl) => {
  const pos = new THREE.Vector3()
  const quat = new THREE.Quaternion()
  const dir = new THREE.Vector3()

  cameraEl.object3D.getWorldPosition(pos)
  cameraEl.object3D.getWorldQuaternion(quat)
  cameraEl.object3D.getWorldDirection(dir)

  return {pos, quat, dir}
}

const projectedHorizontal = (v) => {
  const out = new THREE.Vector3(v.x, 0, v.z)
  if (out.lengthSq() < 0.0001) return new THREE.Vector3(0, 0, -1)
  return out.normalize()
}

AFRAME.registerComponent('wall-poc-controller', {
  schema: {
    autoDistanceM: {default: 1.6},
    stabilizeFrames: {default: 30},
  },

  init() {
    this.cameraEl = $('camera')
    this.posterEl = $('posterPlane')
    this.borderEl = $('posterBorder')
    this.product = getSelectedProduct()

    this.frameCount = 0
    this.ready = false
    this.placed = false
    this.lastCamPos = null
    this.motionScore = 999
    this.wallAngleDeg = 0
    this.distanceM = this.data.autoDistanceM

    applyProduct(this.product)

    this.el.addEventListener('realityready', () => {
      this.ready = true
      this.frameCount = 0
      setStatus('트래킹 시작됨. 벽을 정면으로 비춘 뒤 천천히 움직이세요.')
    })

    this.el.addEventListener('xrtrackingstatus', (event) => {
      console.log('xrtrackingstatus:', event.detail)
    })

    this.el.addEventListener('realityerror', (event) => {
      console.error('realityerror:', event.detail)
      setStatus(`8th Wall 오류: ${event.detail?.error || '알 수 없음'}`)
    })

    document.addEventListener('productchange', (event) => {
      this.product = getProductById(event.detail.productId)
      applyProduct(this.product)

      this.placed = false
      this.frameCount = 0

      if (this.posterEl) this.posterEl.setAttribute('visible', 'false')
      if (this.borderEl) this.borderEl.setAttribute('visible', 'false')

      if (!this.ready) {
        setStatus(`${this.product.name} 선택됨. 트래킹 시작을 기다리는 중...`)
        return
      }

      setStatus(`${this.product.name} 선택됨. 다시 후보 위치 계산 중...`)
    })

    $('recenter')?.addEventListener('click', () => {
      this.placed = false
      this.frameCount = 0

      if (window.XR8?.recenter) window.XR8.recenter()

      if (this.posterEl) this.posterEl.setAttribute('visible', 'false')
      if (this.borderEl) this.borderEl.setAttribute('visible', 'false')

      if (!this.ready) {
        setStatus('카메라/SLAM 초기화 중... 트래킹 시작을 기다리는 중')
        return
      }

      setStatus('재계산 중... 벽을 정면으로 비추세요.')
    })

    // Explicit absolute scale configuration for the binary engine path.
    const configure = () => {
      try {
        if (window.XR8?.XrController) {
          window.XR8.XrController.configure({
            disableWorldTracking: false,
            enableLighting: true,
            scale: 'absolute',
          })
        }
      } catch (err) {
        console.warn('XR8 configure skipped:', err)
      }
    }

    if (window.XR8) {
      configure()
    } else {
      window.addEventListener('xrloaded', configure)
    }
  },

  tick() {
    if (!this.cameraEl || !this.posterEl) return

    const cam = cameraWorld(this.cameraEl)

    if (this.lastCamPos) {
      this.motionScore = cam.pos.distanceTo(this.lastCamPos)
    }

    this.lastCamPos = cam.pos.clone()

    // 중요:
    // realityready가 오기 전에는 자동 배치를 절대 하지 않는다.
    // 기존 코드는 ready가 false여도 30프레임 후 placeEstimatedWall()이 실행될 수 있었다.
    if (!this.ready) {
      setStatus('카메라/SLAM 초기화 중... 카메라 권한과 트래킹 시작을 기다리는 중')
      return
    }

    if (this.placed) {
      this.updateDiagnostics(cam)
      return
    }

    this.frameCount += 1

    const stableEnough = this.frameCount > this.data.stabilizeFrames
    if (!stableEnough) {
      const percent = Math.min(100, Math.round((this.frameCount / this.data.stabilizeFrames) * 100))
      setStatus(`공간 스캔 중... ${percent}%`)
      return
    }

    this.placeEstimatedWall(cam)
  },

  placeEstimatedWall(cam) {
    const forward = projectedHorizontal(cam.dir)
    const cameraHeight = Number.isFinite(cam.pos.y) && Math.abs(cam.pos.y) > 0.2 ? cam.pos.y : 1.55

    // 8th Wall World Effects does not expose a vertical-wall plane classification API here.
    // For this PoC, we create a vertical plane candidate in the camera's forward direction,
    // then keep it world-locked with 8th Wall SLAM. This verifies tracking + absolute scale.
    const center = cam.pos.clone().add(forward.clone().multiplyScalar(this.distanceM))
    center.y = Math.max(1.1, Math.min(1.7, cameraHeight - 0.15))

    this.posterEl.object3D.position.copy(center)
    this.posterEl.object3D.lookAt(cam.pos.x, center.y, cam.pos.z)

    // A-Frame plane often appears mirrored after lookAt; rotate 180 around Y to keep front-facing.
    this.posterEl.object3D.rotateY(Math.PI)

    this.posterEl.setAttribute('visible', 'true')

    if (this.borderEl) {
      this.borderEl.object3D.position.copy(this.posterEl.object3D.position)
      this.borderEl.object3D.quaternion.copy(this.posterEl.object3D.quaternion)
      this.borderEl.setAttribute('visible', 'true')
      createBorder(this.posterEl, this.product)
    }

    this.wallAngleDeg = THREE.MathUtils.radToDeg(Math.atan2(forward.x, -forward.z))
    this.placed = true

    this.updateDiagnostics(cam)
  },

  updateDiagnostics(cam) {
    const dist = cam.pos.distanceTo(this.posterEl.object3D.position)
    const productName = this.product?.name || 'image'

    setStatus(
      `${productName} | 추정거리 ${dist.toFixed(2)}m | 벽 후보각 ${this.wallAngleDeg.toFixed(0)}° | 후보 배치됨`
    )
  },
})

window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.product').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.product').forEach((b) => b.classList.remove('selected'))
      button.classList.add('selected')

      document.dispatchEvent(
        new CustomEvent('productchange', {
          detail: {
            productId: button.dataset.productId,
          },
        })
      )
    })
  })

  window.addEventListener('xrloaded', () => {
    setStatus('8th Wall Engine 로드됨. 카메라 권한을 허용하세요.')
  })

  window.addEventListener('error', (event) => {
    const message = event?.message || ''

    if (/XR8|xrextras|landing|aframe/i.test(message)) {
      console.error('script error:', event)
      setStatus(`스크립트 오류: ${message}`)
    }
  })
})