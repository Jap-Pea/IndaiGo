// =============================================================
//  INDAIGO   DRIFT  —  slidey handling + handbrake
//  Version: 1.0.3
// =============================================================

// ---------- Canvas & UI ----------
const canvas = document.getElementById('game')
const ctx = canvas.getContext('2d')
const ui = {
  speed: document.getElementById('speed'),
  slide: document.getElementById('slide'),
  hb: document.getElementById('hb'),
}
const CANVAS_WIDTH = canvas.width
const CANVAS_HEIGHT = canvas.height

// ---------- Input (keyboard + touch) ----------
const inputState = Object.create(null)
addEventListener('keydown', (ev) => {
  inputState[ev.key] = true
  // prevent scrolling / browser shortcuts while driving
  if (
    ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(ev.key) ||
    ev.code === 'Space'
  ) {
    ev.preventDefault()
  }
})
addEventListener('keyup', (ev) => {
  inputState[ev.key] = false
})

// Touch controls setup (Pointer Events for multi-input)
const controlsWrap = document.getElementById('controls')
const steeringPad = document.getElementById('steerPad')
const steeringStick = document.getElementById('stick')
const gasButton = document.getElementById('gasBtn')
const brakeButton = document.getElementById('brakeBtn')
const handbrakeButton = document.getElementById('handBtn')

let steeringAnalogX = 0 // -1..1 from the steering pad
if ('ontouchstart' in window) controlsWrap.removeAttribute('aria-hidden')

// hold helper for buttons (works with mouse AND touch)
function bindPointerHold(element, onPress, onRelease) {
  const handleDown = (ev) => {
    onPress()
    element.setPointerCapture?.(ev.pointerId)
  }
  const handleUp = () => onRelease()
  element.addEventListener('pointerdown', handleDown)
  element.addEventListener('pointerup', handleUp)
  element.addEventListener('pointercancel', handleUp)
  element.addEventListener('pointerleave', handleUp)
}
bindPointerHold(
  gasButton,
  () => {
    inputState['w'] = inputState['ArrowUp'] = true
  },
  () => {
    inputState['w'] = inputState['ArrowUp'] = false
  }
)
bindPointerHold(
  brakeButton,
  () => {
    inputState['s'] = inputState['ArrowDown'] = true
  },
  () => {
    inputState['s'] = inputState['ArrowDown'] = false
  }
)
bindPointerHold(
  handbrakeButton,
  () => {
    inputState[' '] = inputState['Space'] = true
  },
  () => {
    inputState[' '] = inputState['Space'] = false
  }
)

// steering pad (pointer-based, horizontal only)
function setSteeringStickPosition(leftPixels, topPixels) {
  steeringStick.style.left = leftPixels + 'px'
  steeringStick.style.top = topPixels + 'px'
}
function resetSteeringPad() {
  steeringAnalogX = 0
  setSteeringStickPosition(
    steeringPad.clientWidth / 2,
    steeringPad.clientHeight / 2
  )
}
resetSteeringPad()

function handleSteeringPadPointer(clientX, clientY) {
  const padRect = steeringPad.getBoundingClientRect()
  const padCenterX = padRect.width / 2
  const padCenterY = padRect.height / 2
  const deltaXFromCenter = clientX - padRect.left - padCenterX
  const padRadius = Math.min(padRect.width, padRect.height) / 2 - 10
  const normalizedX = Math.max(-1, Math.min(1, deltaXFromCenter / padRadius))
  steeringAnalogX = normalizedX
  setSteeringStickPosition(padCenterX + normalizedX * padRadius, padCenterY)
}

steeringPad.addEventListener('pointerdown', (e) => {
  handleSteeringPadPointer(e.clientX, e.clientY)
  steeringPad.setPointerCapture?.(e.pointerId)
})
steeringPad.addEventListener('pointermove', (e) => {
  if (e.buttons) handleSteeringPadPointer(e.clientX, e.clientY)
})
steeringPad.addEventListener('pointerup', resetSteeringPad)
steeringPad.addEventListener('pointercancel', resetSteeringPad)

// ---------- Track (walls) ----------
// A simple course inside the viewport. All coords are screen-space.
const trackWalls = [
  // Outer bounds (keep player on screen)
  { x: 20, y: 20, w: CANVAS_WIDTH - 40, h: 10 },
  { x: 20, y: CANVAS_HEIGHT - 30, w: CANVAS_WIDTH - 40, h: 10 },
  { x: 20, y: 20, w: 10, h: CANVAS_HEIGHT - 40 },
  { x: CANVAS_WIDTH - 30, y: 20, w: 10, h: CANVAS_HEIGHT - 40 },
  // Inner pieces to create a loop-ish route
  { x: 200, y: 160, w: CANVAS_WIDTH - 400, h: 10 }, // top straight
  { x: 200, y: CANVAS_HEIGHT - 180, w: CANVAS_WIDTH - 400, h: 10 }, // bottom straight
  { x: 200, y: 160, w: 10, h: 120 }, // hairpin post (left)
  { x: CANVAS_WIDTH - 210, y: CANVAS_HEIGHT - 300, w: 10, h: 120 }, // hairpin post (right)
  { x: 350, y: 325, w: CANVAS_WIDTH - 600, h: 10 }, // mid chicane
]

// ---------- Car state ----------
const carState = {
  x: CANVAS_WIDTH - 260,
  y: CANVAS_HEIGHT - 90,
  ang: -Math.PI / 2, // radians
  vx: 0,
  vy: 0,
  w: 28,
  l: 54,
  angVel: 0,
}

// ---------- Handling parameters (tune these) ----------
const HANDLING = {
  engine: 200, // px/s^2  — forward acceleration
  brake: 100, // px/s^2  — braking acceleration (reverse when moving back)
  baseGrip: 0.2, // lateral grip; LOWER = more slide
  hbGripMul: 1, // multiplier while handbrake held (lower = slipperier)
  sideFriction: 5, // how strongly lateral velocity is killed each frame
  airFriction: 1, // small global damping
  rollResist: 1, // another small damping — feels nice
  tyreDrag: 1, // kills both components slightly => settles oscillations
  maxSteerRate: 3.5, // rad/s potential; scaled by speed below
  speedForMaxSteer: 500, // speed at which we reach ~max steering authority
}

// ---------- Skid mark tuning ----------
const MAX_SKID_POINTS = 600
const SKID_FADE = 0.98
const SKID_ALPHA = 0.5
const SKID_THRESHOLD = 40 // threshold for lateral speed to start dropping marks

// Skid mark storage (two rear rails)
const skidMarksLeft = []
const skidMarksRight = []

// =============================================================
//   (physics)
// =============================================================
function updatePhysics(dtSeconds) {
  // ----- Input state -----
  const throttle = inputState['w'] || inputState['ArrowUp']
  const brake = inputState['s'] || inputState['ArrowDown']
  const steerLeft = inputState['a'] || inputState['ArrowLeft']
  const steerRight = inputState['d'] || inputState['ArrowRight']
  const handbrake =
    inputState[' '] || inputState['Space'] || inputState['Spacebar']

  // ----- Basis vectors aligned to VISUAL car front -----
  // Our car's "nose" graphics point toward -local Y
  const cosAngle = Math.cos(carState.ang)
  const sinAngle = Math.sin(carState.ang)
  const forwardAxis = { x: sinAngle, y: -cosAngle } // forward (matches nose)
  const rightAxis = { x: cosAngle, y: sinAngle } // right (local +X)

  // ----- Decompose current velocity into forward / lateral -----
  const forwardVelocityComponent =
    carState.vx * forwardAxis.x + carState.vy * forwardAxis.y
  const lateralVelocityComponent =
    carState.vx * rightAxis.x + carState.vy * rightAxis.y

  // ----- Throttle / Brake (apply along forward axis) -----
  if (throttle) {
    carState.vx += forwardAxis.x * HANDLING.engine * dtSeconds
    carState.vy += forwardAxis.y * HANDLING.engine * dtSeconds
  }
  if (brake) {
    carState.vx -= forwardAxis.x * HANDLING.brake * dtSeconds
    carState.vy -= forwardAxis.y * HANDLING.brake * dtSeconds
  }

  // ----- Steering authority scales with speed (but never 0) -----
  const speedMagnitude = Math.hypot(carState.vx, carState.vy)
  const steeringAuthority =
    0.35 + 0.65 * Math.min(1, speedMagnitude / HANDLING.speedForMaxSteer)
  const steeringInput =
    (steerLeft ? -1 : 0) + (steerRight ? 1 : 0) + steeringAnalogX
  const targetAngularVelocity =
    steeringInput * HANDLING.maxSteerRate * steeringAuthority
  const angularLerp = Math.min(1, 12 * dtSeconds) // smoothing
  carState.angVel += (targetAngularVelocity - carState.angVel) * angularLerp
  carState.ang += carState.angVel * dtSeconds

  // ----- Lateral friction (drift control) -----
  const effectiveGrip = HANDLING.baseGrip * (handbrake ? HANDLING.hbGripMul : 1)
  const lateralKill =
    lateralVelocityComponent * HANDLING.sideFriction * effectiveGrip * dtSeconds
  carState.vx -= rightAxis.x * lateralKill
  carState.vy -= rightAxis.y * lateralKill

  // ----- Tyre drag + small global damping -----
  carState.vx *= HANDLING.tyreDrag
  carState.vy *= HANDLING.tyreDrag
  carState.vx *= HANDLING.airFriction
  carState.vy *= HANDLING.airFriction
  carState.vx *= HANDLING.rollResist
  carState.vy *= HANDLING.rollResist

  // ----- Integrate position -----
  carState.x += carState.vx * dtSeconds
  carState.y += carState.vy * dtSeconds

  // ----- Collisions (AABB vs walls) -----
  const carAABB = {
    x: carState.x - carState.w / 2,
    y: carState.y - carState.l / 2,
    w: carState.w,
    h: carState.l,
  }
  for (const wallRect of trackWalls) {
    if (aabbIntersect(carAABB, wallRect)) {
      const overlapRight = wallRect.x + wallRect.w - carAABB.x
      const overlapLeft = carAABB.x + carAABB.w - wallRect.x
      const overlapBottom = wallRect.y + wallRect.h - carAABB.y
      const overlapTop = carAABB.y + carAABB.h - wallRect.y
      const minOverlapX = Math.min(overlapRight, overlapLeft)
      const minOverlapY = Math.min(overlapBottom, overlapTop)
      if (minOverlapX < minOverlapY) {
        const pushDirX = overlapRight < overlapLeft ? 1 : -1
        carState.x += pushDirX * (minOverlapX + 0.5)
        carState.vx = 0
      } else {
        const pushDirY = overlapBottom < overlapTop ? 1 : -1
        carState.y += pushDirY * (minOverlapY + 0.5)
        carState.vy = 0
      }
    }
  }

  // ----- UI -----
  ui.speed.textContent = Math.round(speedMagnitude * 3.6)
  ui.slide.textContent = Math.min(
    99,
    Math.round(Math.abs(lateralVelocityComponent) * 0.5)
  )
  ui.hb.textContent = handbrake ? 'ON' : 'OFF'
}

function aabbIntersect(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  )
}

// ---------- Local → World helper (for wheel positions) ----------
function localToWorld(xLocal, yLocal) {
  // rightAxis = (cos, sin), forwardAxis = (sin, -cos) for -localY nose
  const cosA = Math.cos(carState.ang)
  const sinA = Math.sin(carState.ang)
  const rightAxis = { x: cosA, y: sinA }
  const forwardAxis = { x: sinA, y: -cosA }

  // world = car + x*right - y*forward   (since -localY is forward)
  return {
    x: carState.x + xLocal * rightAxis.x - yLocal * forwardAxis.x,
    y: carState.y + xLocal * rightAxis.y - yLocal * forwardAxis.y,
  }
}

// =============================================================
//  D R A W   (visuals)
// =============================================================
function drawScene() {
  // Asphalt background
  const asphaltGradient = ctx.createLinearGradient(
    0,
    0,
    CANVAS_WIDTH,
    CANVAS_HEIGHT
  )
  asphaltGradient.addColorStop(0, '#333333ff')
  asphaltGradient.addColorStop(1, '#353535ff')
  ctx.fillStyle = asphaltGradient
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  // Faint lane lines (just for texture)
  ctx.save()
  ctx.globalAlpha = 0.06
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2
  ctx.setLineDash([6, 10])
  for (let y = 60; y < CANVAS_HEIGHT - 60; y += 40) {
    ctx.beginPath()
    ctx.moveTo(60, y)
    ctx.lineTo(CANVAS_WIDTH - 60, y)
    ctx.stroke()
  }
  for (let x = 60; x < CANVAS_WIDTH - 60; x += 60) {
    ctx.beginPath()
    ctx.moveTo(x, 60)
    ctx.lineTo(x, CANVAS_HEIGHT - 60)
    ctx.stroke()
  }
  ctx.restore()

  // Walls
  ctx.fillStyle = '#0a0d18'
  ctx.strokeStyle = '#000000ff'
  ctx.lineWidth = 2
  for (const wallRect of trackWalls) {
    ctx.fillRect(wallRect.x, wallRect.y, wallRect.w, wallRect.h)
    ctx.strokeRect(
      wallRect.x + 0.5,
      wallRect.y + 0.5,
      wallRect.w - 1,
      wallRect.h - 1
    )
  }

  // ----- Skid marks (two rear wheels) -----
  const lateralSpeedNow = Math.abs(
    carState.vx * -Math.sin(carState.ang) + carState.vy * Math.cos(carState.ang)
  )

  if (lateralSpeedNow > SKID_THRESHOLD) {
    // Rear wheel local positions: x = ±(car.w/2 - 6), y near rear axle
    const wheelOffsetX = carState.w / 2 - 6
    const rearAxleLocalY = carState.l / 2 - 18 // aligns with drawn rear wheels

    const leftWheelWorld = localToWorld(-wheelOffsetX, rearAxleLocalY)
    const rightWheelWorld = localToWorld(wheelOffsetX, rearAxleLocalY)

    skidMarksLeft.push({
      x: leftWheelWorld.x,
      y: leftWheelWorld.y,
      alpha: SKID_ALPHA,
    })
    skidMarksRight.push({
      x: rightWheelWorld.x,
      y: rightWheelWorld.y,
      alpha: SKID_ALPHA,
    })

    if (skidMarksLeft.length > MAX_SKID_POINTS) skidMarksLeft.shift()
    if (skidMarksRight.length > MAX_SKID_POINTS) skidMarksRight.shift()
  }

  for (const mark of skidMarksLeft) {
    ctx.fillStyle = `rgba(20,22,30,${mark.alpha})`
    ctx.beginPath()
    ctx.arc(mark.x, mark.y, 2, 0, Math.PI * 2)
    ctx.fill()
    mark.alpha *= SKID_FADE
  }
  for (const mark of skidMarksRight) {
    ctx.fillStyle = `rgba(20,22,30,${mark.alpha})`
    ctx.beginPath()
    ctx.arc(mark.x, mark.y, 2, 0, Math.PI * 2)
    ctx.fill()
    mark.alpha *= SKID_FADE
  }

  // Car
  ctx.save()
  ctx.translate(carState.x, carState.y)
  ctx.rotate(carState.ang)
  // Body
  fillRoundedRect(
    ctx,
    -carState.w / 2,
    -carState.l / 2,
    carState.w,
    carState.l,
    6,
    '#53ffa3'
  )
  // Roof stripe
  ctx.fillStyle = '#0b0d12'
  ctx.fillRect(-carState.w / 2 + 6, -10, carState.w - 12, 20)
  // BRIGHT NOSE (points where physics forward goes)
  ctx.fillStyle = '#67e8f9'
  ctx.beginPath()
  ctx.moveTo(0, -carState.l / 2 - 6) // nose tip
  ctx.lineTo(-8, -carState.l / 2 + 10)
  ctx.lineTo(8, -carState.l / 2 + 10)
  ctx.closePath()
  ctx.fill()
  // Wheels
  ctx.fillStyle = '#1a1f2e'
  ctx.fillRect(-carState.w / 2 - 6, -carState.l / 2 + 6, 12, 18)
  ctx.fillRect(carState.w / 2 - 6, -carState.l / 2 + 6, 12, 18)
  ctx.fillRect(-carState.w / 2 - 6, carState.l / 2 - 24, 12, 18)
  ctx.fillRect(carState.w / 2 - 6, carState.l / 2 - 24, 12, 18)
  ctx.restore()

  // Hint
  ctx.fillStyle = '#c9d7ff'
  ctx.globalAlpha = 0.9
  ctx.font = '12px system-ui'
  ctx.fillText('Hold SPACE for handbrake (reduced lateral grip).', 16, 18)
  ctx.globalAlpha = 1
}

function fillRoundedRect(ctx, x, y, w, h, r, fillColor) {
  let radius = r
  if (radius > w / 2) radius = w / 2
  if (radius > h / 2) radius = h / 2
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
  ctx.fillStyle = fillColor
  ctx.fill()
}

// =============================================================
//  L O O P
// =============================================================
let lastFrameTime = performance.now()
function gameLoop(nowMs) {
  const dtSeconds = Math.min(0.032, (nowMs - lastFrameTime) / 1000)
  lastFrameTime = nowMs
  updatePhysics(dtSeconds)
  drawScene()
  requestAnimationFrame(gameLoop)
}
requestAnimationFrame(gameLoop)
