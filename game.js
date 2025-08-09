let playerName = ''
let score = 0
let highScore = 0
let lives = 3
let level = 1

function startIntro() {
  document.body.classList.add('intro-active')

  const sound = document.getElementById('logo-sound')
  const flash = document.getElementById('flash-screen')
  const logo = document.getElementById('logo')

  // Flash effect
  flash.style.opacity = '1'
  setTimeout(() => {
    flash.style.opacity = '0'
  }, 300)

  // Play sound and start animations
  sound.play()
  logo.style.animation = 'fadeIn 2s forwards, shake 1.5s ease-in-out 2s'

  // After intro, show title screen
  setTimeout(() => {
    document.body.classList.remove('intro-active')
    document.getElementById('logo-screen').style.display = 'none'
    document.getElementById('title-screen').style.display = 'block'
  }, 6000)
}

function startGame() {
  const fade = document.getElementById('fade-layer')
  const logo = document.getElementById('title-logo')

  document
    .querySelectorAll('#title-screen button')
    .forEach((btn) => (btn.disabled = true))

  fade.style.background = 'white'
  fade.style.transition = 'opacity 3s ease-in-out'
  fade.style.opacity = '1'

  logo.style.position = 'absolute'
  logo.style.transition =
    'transform 3s ease-in-out, top 3s ease-in-out, left 3s ease-in-out'
  logo.style.zIndex = '9999'
  logo.style.left = '50%'
  logo.style.top = '10%'
  logo.style.transform = 'translate(-50%, 0) scale(1)'

  setTimeout(() => {
    logo.style.top = '50%'
    logo.style.transform = 'translate(-50%, -50%) scale(3)'
  }, 100)

  setTimeout(() => {
    fade.style.background = 'black'
  }, 3000)

  setTimeout(() => {
    document.getElementById('title-screen').style.display = 'none'
    fade.style.opacity = '0'
    logo.removeAttribute('style')

    document.getElementById('player-name-screen').style.display = 'block'
  }, 4500)
}

function confirmName() {
  const nameInput = document.getElementById('player-name')
  const name = nameInput.value.trim()

  if (!name) {
    alert('Please enter a name!')
    return
  }

  playerName = name
  highScore = parseInt(localStorage.getItem(`highscore_${playerName}`)) || 0

  document.getElementById('player-name-screen').style.display = 'none'
  document.getElementById('scoreboard').style.display = 'block'

  score = 0
  lives = 3
  level = 1

  updateScoreboard()
  launchGame()
}

function updateScoreboard() {
  document.getElementById(
    'player-display'
  ).textContent = `Player: ${playerName}`
  document.getElementById('score-display').textContent = `Score: ${score}`
  document.getElementById(
    'highscore-display'
  ).textContent = `High Score: ${highScore}`
  document.getElementById('lives-display').textContent = `Lives: ${lives}`
}

function openOptions() {
  alert('Options coming soon!')
}

function goHome() {
  window.location.href = 'index.html'
}

function launchGame() {
  const gameScreen = document.getElementById('game-screen')
  gameScreen.style.display = 'flex'
  gameScreen.innerHTML = `
  <canvas id="game-canvas" width="640" height="576"></canvas>
  <div id="controls" style="display: flex; justify-content: center; align-items: center; margin-top: 20px; gap: 10px; flex-wrap: wrap;">
    <div class="dpad" style="display: flex; gap: 10px;">
      <button id="left-btn" style="font-size: 2rem; padding: 20px 30px;">◄</button>
      <button id="right-btn" style="font-size: 2rem; padding: 20px 30px;">►</button>
    </div>
    <div class="action-buttons" style="margin-left: 20px;">
      <button id="shoot-btn" style="font-size: 2rem; padding: 20px 40px;">A</button>
    </div>
  </div>
`

  // Lock scroll during gameplay
  document.body.style.overflow = 'hidden'
  window.scrollTo(0, 0)

  const canvas = document.getElementById('game-canvas')
  const ctx = canvas.getContext('2d')

  let player = {
    x: canvas.width / 2 - 16,
    y: canvas.height - 40,
    width: 32,
    height: 16,
    speed: 6,
  }
  let bullets = []
  let enemies = []
  let enemyDir = 1
  let enemySpeed = 1 + level * 0.2
  let powerUps = []

  const leftBtn = document.getElementById('left-btn')
  const rightBtn = document.getElementById('right-btn')
  const shootBtn = document.getElementById('shoot-btn')

  ;[leftBtn, rightBtn, shootBtn].forEach((btn) => {
    btn.style.userSelect = 'none'
    btn.style.webkitUserSelect = 'none'
    btn.style.msUserSelect = 'none'
    btn.style.outline = 'none'
  })

  let leftInterval, rightInterval

  leftBtn.addEventListener('touchstart', () => {
    moveLeft()
    leftInterval = setInterval(moveLeft, 50)
  })
  leftBtn.addEventListener('touchend', () => clearInterval(leftInterval))

  rightBtn.addEventListener('touchstart', () => {
    moveRight()
    rightInterval = setInterval(moveRight, 50)
  })
  rightBtn.addEventListener('touchend', () => clearInterval(rightInterval))

  shootBtn.addEventListener('touchstart', () => shoot())

  document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        moveLeft()
        break
      case 'ArrowRight':
      case 'd':
      case 'D':
        moveRight()
        break
      case ' ':
      case 'Spacebar':
      case 'w':
      case 'W':
        shoot()
        break
    }
  })

  window.moveLeft = () => {
    player.x = Math.max(0, player.x - player.speed)
  }

  window.moveRight = () => {
    player.x = Math.min(canvas.width - player.width, player.x + player.speed)
  }

  window.shoot = () => {
    bullets.push({ x: player.x + 12, y: player.y })
  }

  function dropPowerUp(x, y) {
    powerUps.push({ x, y, type: 'score', width: 10, height: 10 })
  }

  function createEnemies() {
    enemies = []
    for (let i = 0; i < 6 + level; i++) {
      enemies.push({ x: 30 + i * 40, y: 30, width: 20, height: 20 })
    }
  }

  createEnemies()

  function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    let hitEdge = false
    enemies.forEach((e) => {
      e.x += enemySpeed * enemyDir
      if (e.x <= 0 || e.x + e.width >= canvas.width) hitEdge = true
    })
    if (hitEdge) {
      enemyDir *= -1
      enemies.forEach((e) => (e.y += 20))
    }

    ctx.fillStyle = '#00ffcc'
    ctx.fillRect(player.x, player.y, player.width, player.height)

    ctx.fillStyle = '#fff'
    bullets.forEach((bullet, i) => {
      bullet.y -= 5
      ctx.fillRect(bullet.x, bullet.y, 4, 8)
      if (bullet.y < 0) bullets.splice(i, 1)
    })

    ctx.fillStyle = '#ff4444'
    enemies.forEach((enemy, ei) => {
      ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height)
      bullets.forEach((bullet, bi) => {
        if (
          bullet.x < enemy.x + enemy.width &&
          bullet.x + 4 > enemy.x &&
          bullet.y < enemy.y + enemy.height &&
          bullet.y + 8 > enemy.y
        ) {
          bullets.splice(bi, 1)
          enemies.splice(ei, 1)
          score += 10
          if (Math.random() < 0.2) dropPowerUp(enemy.x, enemy.y)
        }
      })
    })

    ctx.fillStyle = '#ffff00'
    powerUps.forEach((p, i) => {
      p.y += 1
      ctx.fillRect(p.x, p.y, p.width, p.height)
      if (
        p.x < player.x + player.width &&
        p.x + p.width > player.x &&
        p.y < player.y + player.height &&
        p.y + p.height > player.y
      ) {
        powerUps.splice(i, 1)
        score += 20
      }
    })

    if (score > highScore) {
      highScore = score
      localStorage.setItem(`highscore_${playerName}`, highScore)
    }

    updateScoreboard()

    if (enemies.length === 0) {
      level++
      enemySpeed += 0.5
      createEnemies()
    }

    requestAnimationFrame(gameLoop)
  }

  gameLoop()
}
