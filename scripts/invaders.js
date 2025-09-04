/**********************
 * IndaiGo Invaders
 * Toggles: F1 = HUD on/off, P = Pause
 **********************/

// ===== Canvas & UI =====
const canvas = document.getElementById('game')
const ctx = canvas.getContext('2d')
const scoreLabel = document.getElementById('score')
const livesLabel = document.getElementById('lives')
const restartBtn = document.getElementById('restart')
const startBtn = document.getElementById('start')
const nameInput = document.getElementById('playerName')
const highscoresList = document.getElementById('highscores')

const CANVAS_W = canvas.width
const CANVAS_H = canvas.height

// ===== Game Modes: 'Menu' | 'Playing' | 'GameOver' =====
let gameMode = 'menu'

// ===== Input & Game State =====
let pressedKeys = new Set()

let playerBullets = []
let enemyBullets = []
let enemies = []

let enemyDirection = 1 // 1 = right, -1 = left
let enemySpeed = 0.6 // base horizontal speed (scaled by dt)
let enemyStepDown = 15 // vertical drop when edges are hit
let enemyFireRate = 0.002 // chance per enemy per frame to fire

let score = 0
let lives = 3

// Player
const player = {
  x: CANVAS_W / 2,
  y: CANVAS_H - 40,
  width: 30,
  height: 10,
  moveSpeed: 4, // pixels per 60fps-normalized frame
  shootCooldown: 0, // frames (counts down)
}

// ===== Highscores =====
const HIGHSCORES_KEY = 'IndaiGoInvadersHighscores'

function escapeHtml(s) {
  return s.replace(
    /[&<>"']/g,
    (m) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[
        m
      ])
  )
}
function getHighscores() {
  try {
    return JSON.parse(localStorage.getItem(HIGHSCORES_KEY) || '[]')
  } catch {
    return []
  }
}
function setHighscores(arr) {
  localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(arr))
  renderHighscores(arr)
}
function saveHighscore(name, sc) {
  const clean = (name || 'Player').trim() || 'Player'
  let list = getHighscores()
  list.push({ name: clean.slice(0, 24), score: sc, at: Date.now() })
  list.sort((a, b) => b.score - a.score || a.at - b.at)
  list = list.slice(0, 5)
  setHighscores(list)
}
function renderHighscores(arr = getHighscores()) {
  highscoresList.innerHTML = arr.length
    ? arr
        .map((e, i) => `<li>${i + 1}. ${escapeHtml(e.name)} — ${e.score}</li>`)
        .join('')
    : `<li>No scores yet — Probably wont be saved!</li>`
}

function renderHighScores(list) {
  const ol = document.getElementById('highscores')
  ol.innerHTML = list
    .map((s, i) => `<li>${i + 1}. ${s.name} — ${s.score}</li>`)
    .join('')
  const panel = ol.closest('.scores')
  if (panel) {
    panel.classList.remove('scores--pulse')
    // Force reflow so animation retriggers
    void panel.offsetWidth
    panel.classList.add('scores--pulse')
  }
}

renderHighscores()

// ===== Helpers =====
function drawRect(x, y, w, h, col) {
  ctx.fillStyle = col
  ctx.fillRect(x, y, w, h)
}

// Axis-aligned rectangle collision (AABB)
function aabbCollide(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  )
}

function resetGame() {
  pressedKeys.clear()
  playerBullets = []
  enemyBullets = []
  score = 0
  lives = 3

  enemyDirection = 1
  enemySpeed = 0.6
  enemyFireRate = 0.002

  player.x = CANVAS_W / 2
  player.shootCooldown = 0

  spawnEnemies()
  restartBtn.hidden = true
  updateHUD()
}

function updateHUD() {
  scoreLabel.textContent = `Score: ${score}`
  livesLabel.textContent = `Lives: ${lives}`
}

// ===== Enemies =====
function spawnEnemies() {
  enemies = []
  const COLS = 10,
    ROWS = 4
  const GAP_X = 12,
    GAP_Y = 16
  const EN_W = 42,
    EN_H = 18

  const startX = (CANVAS_W - (COLS * EN_W + (COLS - 1) * GAP_X)) / 2
  const startY = 60

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      enemies.push({
        x: startX + c * (EN_W + GAP_X),
        y: startY + r * (EN_H + GAP_Y),
        w: EN_W,
        h: EN_H,
        hp: 1,
      })
    }
  }
}

// ===== Input =====
addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault()
  pressedKeys.add(e.key)
  if ((gameMode === 'gameover' || gameMode === 'menu') && e.key === 'Enter')
    startGame()
})
addEventListener('keyup', (e) => pressedKeys.delete(e.key))

startBtn.addEventListener('click', startGame)
restartBtn.addEventListener('click', startGame)

function startGame() {
  if (!nameInput.value.trim()) nameInput.value = 'Player'
  gameMode = 'playing'
  resetGame()
}

// ===== Dev toggles (minimal) =====
let DEBUG = true // F1 toggles HUD visibility
let PAUSED = false // P toggles pause

addEventListener('keydown', (e) => {
  if (e.key === 'F1') {
    e.preventDefault()
    DEBUG = !DEBUG
  }
  if (e.key.toLowerCase() === 'p') {
    PAUSED = !PAUSED
  }
})

// Minimal HUD
function drawDevHUD() {
  if (!DEBUG) return
  const L = (s, y) => {
    ctx.fillStyle = '#cfe8ff'
    ctx.font = '12px system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(s, 8, y)
  }
  L(`Mode: ${gameMode}${PAUSED ? ' (Paused)' : ''}`, 14)
  L(`Score: ${score}`, 28)
  L(`Lives: ${lives}`, 42)
}

// ===== Game Loop (restored) =====
let lastTs = 0
function loop(ts) {
  const dt = (ts - lastTs) / (1000 / 60) // 60fps-normalized delta
  lastTs = ts

  if (!PAUSED) update(dt)
  draw()

  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)

// ===== Update =====
function update(dt) {
  if (gameMode !== 'playing') return

  // Player movement
  if (pressedKeys.has('ArrowLeft')) player.x -= player.moveSpeed * dt
  if (pressedKeys.has('ArrowRight')) player.x += player.moveSpeed * dt
  player.x = Math.max(20, Math.min(CANVAS_W - 20, player.x))

  if (player.shootCooldown > 0) player.shootCooldown -= dt

  // Shoot
  if (pressedKeys.has(' ') && player.shootCooldown <= 0) {
    playerBullets.push({
      x: player.x - 2,
      y: player.y - 12,
      w: 4,
      h: 10,
      vy: -6,
    })
    player.shootCooldown = 10 // frames
  }

  // Player bullets
  playerBullets.forEach((b) => (b.y += b.vy * dt))
  playerBullets = playerBullets.filter((b) => b.y + b.h > -5)

  // Enemies
  let hitEdge = false
  enemies.forEach((e) => {
    e.x += enemyDirection * enemySpeed * dt * 2.0
    if (e.x < 10 || e.x + e.w > CANVAS_W - 10) hitEdge = true

    // Random enemy fire
    if (Math.random() < enemyFireRate) {
      enemyBullets.push({
        x: e.x + e.w / 2 - 2,
        y: e.y + e.h,
        w: 4,
        h: 10,
        vy: 3,
      })
    }
  })

  if (hitEdge) {
    enemyDirection *= -1
    enemies.forEach((e) => (e.y += enemyStepDown))
  }

  // Enemy bullets
  enemyBullets.forEach((b) => (b.y += b.vy * dt))
  enemyBullets = enemyBullets.filter((b) => b.y < CANVAS_H + 20)

  // Collisions: player bullets vs enemies
  for (let i = playerBullets.length - 1; i >= 0; i--) {
    for (let j = enemies.length - 1; j >= 0; j--) {
      if (aabbCollide(playerBullets[i], enemies[j])) {
        enemies.splice(j, 1)
        playerBullets.splice(i, 1)
        score += 10
        updateHUD()
        break
      }
    }
  }

  // Collisions: enemy bullets vs player
  const playerHitbox = { x: player.x - 18, y: player.y - 6, w: 36, h: 16 }
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    if (aabbCollide(enemyBullets[i], playerHitbox)) {
      enemyBullets.splice(i, 1)
      lives -= 1
      updateHUD()
      if (lives <= 0) {
        endGame()
        return
      }
    }
  }

  // Lose if enemies reach player line
  if (enemies.some((e) => e.y + e.h >= player.y - 4)) {
    endGame()
    return
  }

  // Next wave
  if (enemies.length === 0) {
    enemySpeed += 0.25
    enemyFireRate += 0.0005
    spawnEnemies()
  }
}

// ===== End Game =====
function endGame() {
  gameMode = 'gameover'
  saveHighscore(nameInput.value, score)
  renderHighscores()
  restartBtn.hidden = false
}

// ===== Draw =====
function draw() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

  // Starfield
  for (let i = 0; i < 120; i++) {
    const x = (i * 53) % CANVAS_W,
      y = (i * 97) % CANVAS_H
    ctx.fillStyle = i % 9 ? '#0f2642' : '#134b8a'
    ctx.fillRect(x, y, 2, 2)
  }

  // Menu / Gameover overlays
  if (gameMode !== 'playing') {
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    if (gameMode === 'menu') {
      ctx.font = 'bold 30px system-ui, sans-serif'
      ctx.fillText('IndaiGo Invaders', CANVAS_W / 2, CANVAS_H / 2 - 20)
      ctx.font = '16px system-ui, sans-serif'
      ctx.fillText(
        'Enter your name below and press Start Game',
        CANVAS_W / 2,
        CANVAS_H / 2 + 10
      )
    } else if (gameMode === 'gameover') {
      ctx.font = 'bold 28px system-ui, sans-serif'
      ctx.fillText('Game Over', CANVAS_W / 2, CANVAS_H / 2 - 12)
      ctx.font = '16px system-ui, sans-serif'
      ctx.fillText(
        'Press Restart or Enter to play again',
        CANVAS_W / 2,
        CANVAS_H / 2 + 16
      )
      ctx.fillText(`Final Score: ${score}`, CANVAS_W / 2, CANVAS_H / 2 + 40)
    }
    drawDevHUD() // show HUD even in menu/paused
    return
  }

  // Player
  ctx.save()
  ctx.translate(player.x, player.y)
  drawRect(-18, -6, 36, 12, '#7ce2ff')
  drawRect(-12, -10, 24, 6, '#b6f1ff')
  drawRect(-3, -14, 6, 6, '#eaffff')
  ctx.restore()

  // Bullets
  playerBullets.forEach((b) => drawRect(b.x, b.y, b.w, b.h, '#ffde59'))
  enemyBullets.forEach((b) => drawRect(b.x, b.y, b.w, b.h, '#ff6b6b'))

  // Enemies
  enemies.forEach((e) => {
    drawRect(e.x, e.y, e.w, e.h, '#7cffb2')
    drawRect(e.x + 10, e.y - 6, e.w - 20, 6, '#a6ffd1')
  })

  drawDevHUD()
}

// ===== Mobile controls → map to keys =====
const btnLeft = document.getElementById('btnLeft')
const btnRight = document.getElementById('btnRight')
const btnFire = document.getElementById('btnFire')

function bindHold(btn, key) {
  if (!btn) return
  const down = (e) => {
    e.preventDefault()
    pressedKeys.add(key)
  }
  const up = (e) => {
    e.preventDefault()
    pressedKeys.delete(key)
  }
  btn.addEventListener('pointerdown', down)
  btn.addEventListener('pointerup', up)
  btn.addEventListener('pointercancel', up)
  btn.addEventListener('pointerleave', up)
}
bindHold(btnLeft, 'ArrowLeft')
bindHold(btnRight, 'ArrowRight')
bindHold(btnFire, ' ') // space = shoot
