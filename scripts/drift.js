// =============================================================
//  IND A I G O   D R I F T  —  slidey handling + handbrake
//  Version: "no-camera" (viewport == world). Keyboard only.
//  Key idea: physics vectors match the VISUAL FRONT of the car.
//            (Forward = -local Y after rotation).
// =============================================================

// ---------- Canvas & UI ----------
const canvas = document.getElementById('game')
const ctx = canvas.getContext('2d')
const ui = {
  speed: document.getElementById('speed'),
  slide: document.getElementById('slide'),
  hb: document.getElementById('hb'),
}
const WIDTH = canvas.width,
  HEIGHT = canvas.height

// ---------- Input (keyboard + touch) ----------
const keys = Object.create(null)
addEventListener('keydown', (e) => {
  keys[e.key] = true
  // prevent scrolling / browser shortcuts while driving
  if (
    ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key) ||
    e.code === 'Space'
  ) {
    e.preventDefault()
  }
})
addEventListener('keyup', (e) => {
  keys[e.key] = false
})

// Touch controls setup (Pointer Events for multi-input)
const ctrlWrap = document.getElementById('controls')
const steerPad = document.getElementById('steerPad')
const stick = document.getElementById('stick')
const gasBtn = document.getElementById('gasBtn')
const brakeBtn = document.getElementById('brakeBtn')
const handBtn = document.getElementById('handBtn')

let steerAnalog = 0 // -1..1 from the steering pad
if ('ontouchstart' in window) ctrlWrap.removeAttribute('aria-hidden')

// hold helper for buttons (works with mouse AND touch)
function bindPointerHold(el, on, off) {
  const down = (e) => {
    on()
    el.setPointerCapture?.(e.pointerId)
  }
  const up = () => off()
  el.addEventListener('pointerdown', down)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
  el.addEventListener('pointerleave', up)
}
bindPointerHold(
  gasBtn,
  () => {
    keys['w'] = keys['ArrowUp'] = true
  },
  () => {
    keys['w'] = keys['ArrowUp'] = false
  }
)
bindPointerHold(
  brakeBtn,
  () => {
    keys['s'] = keys['ArrowDown'] = true
  },
  () => {
    keys['s'] = keys['ArrowDown'] = false
  }
)
bindPointerHold(
  handBtn,
  () => {
    keys[' '] = keys['Space'] = true
  },
  () => {
    keys[' '] = keys['Space'] = false
  }
)

// steering pad (pointer-based, horizontal only)
function setStick(px, py) {
  stick.style.left = px + 'px'
  stick.style.top = py + 'px'
}
function resetPad() {
  steerAnalog = 0
  setStick(steerPad.clientWidth / 2, steerPad.clientHeight / 2)
}
resetPad()

function handlePadPoint(clientX, clientY) {
  const rect = steerPad.getBoundingClientRect()
  const cx = rect.width / 2,
    cy = rect.height / 2
  const dx = clientX - rect.left - cx
  const max = Math.min(rect.width, rect.height) / 2 - 10
  const nx = Math.max(-1, Math.min(1, dx / max))
  steerAnalog = nx
  setStick(cx + nx * max, cy)
}

steerPad.addEventListener('pointerdown', (e) => {
  handlePadPoint(e.clientX, e.clientY)
  steerPad.setPointerCapture?.(e.pointerId)
})
steerPad.addEventListener('pointermove', (e) => {
  if (e.buttons) handlePadPoint(e.clientX, e.clientY)
})
steerPad.addEventListener('pointerup', resetPad)
steerPad.addEventListener('pointercancel', resetPad)

// ---------- Track (walls) ----------
// A simple course inside the viewport. All coords are screen-space.
const walls = [
  // Outer bounds (keep player on screen)
  { x: 20, y: 20, w: WIDTH - 40, h: 10 },
  { x: 20, y: HEIGHT - 30, w: WIDTH - 40, h: 10 },
  { x: 20, y: 20, w: 10, h: HEIGHT - 40 },
  { x: WIDTH - 30, y: 20, w: 10, h: HEIGHT - 40 },
  // Inner pieces to create a loop-ish route
  { x: 200, y: 160, w: WIDTH - 400, h: 10 }, // top straight
  { x: 200, y: HEIGHT - 180, w: WIDTH - 400, h: 10 }, // bottom straight
  { x: 200, y: 160, w: 10, h: 120 }, // hairpin post (left)
  { x: WIDTH - 210, y: HEIGHT - 300, w: 10, h: 120 }, // hairpin post (right)
  { x: 350, y: 325, w: WIDTH - 600, h: 10 }, // mid chicane
]

// ---------- Car state ----------
// Position, velocity (vx,vy), angle (ang), and angular velocity (angVel)
const car = {
  x: WIDTH - 260,
  y: HEIGHT - 90,
  ang: -Math.PI / 2,
  vx: 0,
  vy: 0,
  w: 28,
  l: 54,
  angVel: 0,
}

// ---------- Handling parameters (tune these) ----------
const P = {
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

// =============================================================
//  U P D A T E   (physics)
// =============================================================
function update(dt) {
  // ----- Input state -----
  const up = keys['w'] || keys['ArrowUp']
  const down = keys['s'] || keys['ArrowDown']
  const left = keys['a'] || keys['ArrowLeft']
  const right = keys['d'] || keys['ArrowRight']
  const hand = keys[' '] || keys['Space'] || keys['Spacebar']

  // ----- Basis vectors aligned to VISUAL car front -----
  // We rotate the canvas by car.ang when drawing. After rotation:
  //   local X (+x) -> world ( cosθ,  sinθ)
  //   local Y (+y) -> world (-sinθ,  cosθ)
  // Our car's "nose" graphics point toward -local Y, so
  // FORWARD must be world vector of (-local Y):  ( sinθ, -cosθ )
  const c = Math.cos(car.ang),
    s = Math.sin(car.ang)
  const fwd = { x: s, y: -c } // forward (matches nose)
  const rightV = { x: c, y: s } // right (local +X)

  // ----- Decompose current velocity into forward / lateral -----
  const vF = car.vx * fwd.x + car.vy * fwd.y // forward component (scalar)
  const vR = car.vx * rightV.x + car.vy * rightV.y // lateral/sideways (scalar)

  // ----- Throttle / Brake (apply along forward axis) -----
  if (up) {
    car.vx += fwd.x * P.engine * dt
    car.vy += fwd.y * P.engine * dt
  }
  if (down) {
    car.vx -= fwd.x * P.brake * dt
    car.vy -= fwd.y * P.brake * dt
  }

  // ----- Steering authority scales with speed (but never 0) -----
  const speed = Math.hypot(car.vx, car.vy)
  const steerFactor = 0.35 + 0.65 * Math.min(1, speed / P.speedForMaxSteer)
  const steerInput = (left ? -1 : 0) + (right ? 1 : 0) + steerAnalog
  const steerTarget = steerInput * P.maxSteerRate * steerFactor // desired angular vel
  const lerp = Math.min(1, 12 * dt) // smoothing
  car.angVel += (steerTarget - car.angVel) * lerp
  car.ang += car.angVel * dt

  // ----- Lateral friction (drift control) -----
  const grip = P.baseGrip * (hand ? P.hbGripMul : 1)
  const sideKill = vR * P.sideFriction * grip * dt
  car.vx -= rightV.x * sideKill
  car.vy -= rightV.y * sideKill

  // ----- Tyre drag + small global damping -----
  car.vx *= P.tyreDrag
  car.vy *= P.tyreDrag
  car.vx *= P.airFriction
  car.vy *= P.airFriction
  car.vx *= P.rollResist
  car.vy *= P.rollResist

  // ----- Integrate position -----
  car.x += car.vx * dt
  car.y += car.vy * dt

  // ----- Collisions (AABB vs walls) -----
  const bb = {
    x: car.x - car.w / 2,
    y: car.y - car.l / 2,
    w: car.w,
    h: car.l,
  }
  for (const w of walls) {
    if (aabb(bb, w)) {
      const dx1 = w.x + w.w - bb.x
      const dx2 = bb.x + bb.w - w.x
      const dy1 = w.y + w.h - bb.y
      const dy2 = bb.y + bb.h - w.y
      const minX = Math.min(dx1, dx2)
      const minY = Math.min(dy1, dy2)
      if (minX < minY) {
        const dir = dx1 < dx2 ? 1 : -1
        car.x += dir * (minX + 0.5)
        car.vx = 0
      } else {
        const dir = dy1 < dy2 ? 1 : -1
        car.y += dir * (minY + 0.5)
        car.vy = 0
      }
    }
  }

  // ----- UI -----
  ui.speed.textContent = Math.round(speed * 3.6)
  ui.slide.textContent = Math.min(99, Math.round(Math.abs(vR) * 0.5))
  ui.hb.textContent = hand ? 'ON' : 'OFF'
}

function aabb(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  )
}

// =============================================================
//  D R A W   (visuals)
// =============================================================
const skid = [] // tiny particle-ish skid scribbles
function draw() {
  // Asphalt background
  const g = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT)
  g.addColorStop(0, '#333333ff')
  g.addColorStop(1, '#353535ff')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // Faint lane lines (just for texture)
  ctx.save()
  ctx.globalAlpha = 0.06
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2
  ctx.setLineDash([6, 10])
  for (let y = 60; y < HEIGHT - 60; y += 40) {
    ctx.beginPath()
    ctx.moveTo(60, y)
    ctx.lineTo(WIDTH - 60, y)
    ctx.stroke()
  }
  for (let x = 60; x < WIDTH - 60; x += 60) {
    ctx.beginPath()
    ctx.moveTo(x, 60)
    ctx.lineTo(x, HEIGHT - 60)
    ctx.stroke()
  }
  ctx.restore()

  // Walls
  ctx.fillStyle = '#0a0d18'
  ctx.strokeStyle = '#000000ff'
  ctx.lineWidth = 2
  for (const r of walls) {
    ctx.fillRect(r.x, r.y, r.w, r.h)
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1)
  }

  // Skid scribbles when sliding
  const lateralNow = Math.abs(
    car.vx * -Math.sin(car.ang) + car.vy * Math.cos(car.ang)
  )
  if (lateralNow > 40) {
    skid.push({ x: car.x, y: car.y, a: 0.5 })
    if (skid.length > 600) skid.shift()
  }
  for (const p of skid) {
    ctx.fillStyle = `rgba(20,22,30,${p.a})`
    ctx.beginPath()
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2)
    ctx.fill()
    p.a *= 0.98
  }

  // Car
  ctx.save()
  ctx.translate(car.x, car.y)
  ctx.rotate(car.ang)
  // Body
  roundRect(ctx, -car.w / 2, -car.l / 2, car.w, car.l, 6, '#53ffa3')
  // Roof stripe
  ctx.fillStyle = '#0b0d12'
  ctx.fillRect(-car.w / 2 + 6, -10, car.w - 12, 20)
  // BRIGHT NOSE (points where physics forward goes)
  ctx.fillStyle = '#67e8f9'
  ctx.beginPath()
  ctx.moveTo(0, -car.l / 2 - 6) // nose tip
  ctx.lineTo(-8, -car.l / 2 + 10)
  ctx.lineTo(8, -car.l / 2 + 10)
  ctx.closePath()
  ctx.fill()
  // Wheels
  ctx.fillStyle = '#1a1f2e'
  ctx.fillRect(-car.w / 2 - 6, -car.l / 2 + 6, 12, 18)
  ctx.fillRect(car.w / 2 - 6, -car.l / 2 + 6, 12, 18)
  ctx.fillRect(-car.w / 2 - 6, car.l / 2 - 24, 12, 18)
  ctx.fillRect(car.w / 2 - 6, car.l / 2 - 24, 12, 18)
  ctx.restore()

  // Hint
  ctx.fillStyle = '#c9d7ff'
  ctx.globalAlpha = 0.9
  ctx.font = '12px system-ui'
  ctx.fillText('Hold SPACE for handbrake (reduced lateral grip).', 16, 18)
  ctx.globalAlpha = 1
}

function roundRect(ctx, x, y, w, h, r, fill) {
  if (r > w / 2) r = w / 2
  if (r > h / 2) r = h / 2
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
}

// =============================================================
//  L O O P
// =============================================================
let last = performance.now()
function loop(t) {
  const dt = Math.min(0.032, (t - last) / 1000)
  last = t
  update(dt)
  draw()
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)
