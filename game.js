const c = document.getElementById('game');
const ctx = c.getContext('2d');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const restartBtn = document.getElementById('restart');
const startBtn = document.getElementById('start');
const nameInput = document.getElementById('playerName');
const highscoresEl = document.getElementById('highscores');

const W = c.width, H = c.height;

// Modes: 'menu' | 'playing' | 'gameover'
let mode = 'menu';

// Game State
let keys = new Set();
let bullets = [];
let enemies = [];
let enemyDir = 1;
let enemySpeed = 0.6;
let enemyStepDown = 20;
let enemyFireRate = 0.002;
let enemyBullets = [];
let score = 0;
let lives = 3;

const player = { x: W/2, y: H - 40, w: 40, h: 12, speed: 3.2, cooldown: 0 };

// Highscores
const HS_KEY = 'miniBlasterHighscores';

function escapeHtml(s){
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function getHighscores(){
  try { return JSON.parse(localStorage.getItem(HS_KEY) || '[]'); }
  catch { return []; }
}
function setHighscores(arr){
  localStorage.setItem(HS_KEY, JSON.stringify(arr));
  renderHighscores(arr);
}
function saveHighscore(name, sc){
  const clean = (name || 'Player').trim() || 'Player';
  let list = getHighscores();
  list.push({ name: clean.slice(0,24), score: sc, at: Date.now() });
  list.sort((a,b)=> b.score - a.score || a.at - b.at);
  list = list.slice(0,5);
  setHighscores(list);
}
function renderHighscores(arr = getHighscores()){
  highscoresEl.innerHTML = arr.length
    ? arr.map((e,i)=>`<li>${i+1}. ${escapeHtml(e.name)} — ${e.score}</li>`).join('')
    : `<li>No scores yet — be the first!</li>`;
}
renderHighscores();

// Helpers
function rect(x,y,w,h,col){ ctx.fillStyle = col; ctx.fillRect(x,y,w,h); }
function collide(a,b){ return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function reset(){
  keys.clear(); bullets = []; enemyBullets = [];
  score = 0; lives = 3;
  enemyDir = 1; enemySpeed = 0.6; enemyFireRate = 0.002;
  player.x = W/2; player.cooldown = 0;
  spawnEnemies();
  restartBtn.hidden = true;
  updateHUD();
}
function updateHUD(){
  scoreEl.textContent = `Score: ${score}`;
  livesEl.textContent = `Lives: ${lives}`;
}

// Enemies
function spawnEnemies(){
  enemies = [];
  const cols = 10, rows = 4;
  const gapX = 12, gapY = 16;
  const ew = 42, eh = 18;
  const startX = (W - (cols*ew + (cols-1)*gapX)) / 2;
  const startY = 60;
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      enemies.push({ x: startX + c*(ew+gapX), y: startY + r*(eh+gapY), w: ew, h: eh, hp: 1 });
    }
  }
}

// Input
addEventListener('keydown', e => {
  if (['ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
  keys.add(e.key);
  if ((mode === 'gameover' || mode === 'menu') && e.key === 'Enter') startGame();
});
addEventListener('keyup', e => keys.delete(e.key));

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

function startGame(){
  if (!nameInput.value.trim()) nameInput.value = 'Player';
  mode = 'playing';
  reset();
}

// Game Loop
let last = 0;
function loop(ts){
  const dt = (ts - last) / (1000/60);
  last = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Update
function update(dt){
  if (mode !== 'playing') return;

  // player move
  if (keys.has('ArrowLeft'))  player.x -= player.speed * dt;
  if (keys.has('ArrowRight')) player.x += player.speed * dt;
  player.x = Math.max(20, Math.min(W-20, player.x));
  if (player.cooldown > 0) player.cooldown -= dt;

  // shoot
  if (keys.has(' ') && player.cooldown <= 0){
    bullets.push({ x: player.x-2, y: player.y-12, w: 4, h: 10, vy: -6 });
    player.cooldown = 10; // frames
  }

  // bullets
  bullets.forEach(b=> b.y += b.vy * dt);
  bullets = bullets.filter(b => b.y + b.h > -5);

  // enemies
  let hitEdge = false;
  enemies.forEach(e => {
    e.x += enemyDir * enemySpeed * dt * 2.0;
    if (e.x < 10 || e.x + e.w > W-10) hitEdge = true;
    if (Math.random() < enemyFireRate){
      enemyBullets.push({ x: e.x + e.w/2 - 2, y: e.y + e.h, w: 4, h: 10, vy: 3 });
    }
  });
  if (hitEdge){
    enemyDir *= -1;
    enemies.forEach(e => e.y += enemyStepDown);
  }

  // enemy bullets
  enemyBullets.forEach(b=> b.y += b.vy * dt);
  enemyBullets = enemyBullets.filter(b => b.y < H + 20);

  // collisions: player bullets vs enemies
  for (let i=bullets.length-1; i>=0; i--){
    for (let j=enemies.length-1; j>=0; j--){
      if (collide(bullets[i], enemies[j])){
        enemies.splice(j,1);
        bullets.splice(i,1);
        score += 10;
        updateHUD();
        break;
      }
    }
  }

  // collisions: enemy bullets vs player
  for (let i=enemyBullets.length-1; i>=0; i--){
    if (collide(enemyBullets[i], {x:player.x-18, y:player.y-6, w:36, h:16})){
      enemyBullets.splice(i,1);
      lives -= 1;
      updateHUD();
      if (lives <= 0) endGame();
    }
  }

  // lose if enemies reach player line
  if (enemies.some(e => e.y + e.h >= player.y - 4)) endGame();

  // next wave
  if (enemies.length === 0){
    enemySpeed += 0.25;
    enemyFireRate += 0.0005;
    spawnEnemies();
  }
}

function endGame(){
  mode = 'gameover';
  saveHighscore(nameInput.value, score);
  renderHighscores();
  restartBtn.hidden = false;
}

// Draw
function draw(){
  ctx.clearRect(0,0,W,H);

  // stars
  for (let i=0;i<120;i++){
    const x = (i*53 % W), y = (i*97 % H);
    ctx.fillStyle = i%9 ? '#0f2642' : '#134b8a';
    ctx.fillRect(x, y, 2, 2);
  }

  if (mode !== 'playing'){
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    if (mode === 'menu'){
      ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.fillText('Mini Blaster', W/2, H/2 - 20);
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText('Enter your name below and press Start Game', W/2, H/2 + 10);
    } else if (mode === 'gameover'){
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.fillText('Game Over', W/2, H/2 - 12);
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText('Press Restart or Enter to play again', W/2, H/2 + 16);
      ctx.fillText(`Final Score: ${score}`, W/2, H/2 + 40);
    }
    return;
  }

  // player
  ctx.save();
  ctx.translate(player.x, player.y);
  rect(-18,-6,36,12,'#7ce2ff');
  rect(-12,-10,24,6,'#b6f1ff');
  rect(-3,-14,6,6,'#eaffff');
  ctx.restore();

  // bullets
  bullets.forEach(b => rect(b.x,b.y,b.w,b.h,'#ffde59'));
  enemyBullets.forEach(b => rect(b.x,b.y,b.w,b.h,'#ff6b6b'));

  // enemies
  enemies.forEach(e=>{
    rect(e.x,e.y,e.w,e.h,'#7cffb2');
    rect(e.x+10,e.y-6,e.w-20,6,'#a6ffd1');
  });
}

// ----- Mobile controls -> map to keys -----
const btnLeft  = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');
const btnFire  = document.getElementById('btnFire');

function bindHold(btn, key){
  if (!btn) return;
  const down = e => { e.preventDefault(); keys.add(key); };
  const up   = e => { e.preventDefault(); keys.delete(key); };
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up);
  btn.addEventListener('pointerleave', up);
}
bindHold(btnLeft, 'ArrowLeft');
bindHold(btnRight, 'ArrowRight');
bindHold(btnFire, ' '); // space = shoot