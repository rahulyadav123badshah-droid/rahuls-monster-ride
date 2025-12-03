/* Rahul's Snake — Ultimate
 - features: skins, powerups, particles, sounds, swipe controls, leaderboard (localStorage)
 - Paste this fully into game.js and commit
*/

// ---------- Config / assets ----------
const eatSound = new Audio("https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg");
const crashSound = new Audio("https://actions.google.com/sounds/v1/cartoon/boom.ogg");
const powerSound = new Audio("https://actions.google.com/sounds/v1/cartoon/pop.ogg");
const bgMusic = new Audio("https://actions.google.com/sounds/v1/ambiences/waves_crash.ogg"); // ambient as placeholder
bgMusic.loop = true; bgMusic.volume = 0.12;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const menu = document.getElementById('menu');
const playBtn = document.getElementById('playBtn');
const leaderBtn = document.getElementById('leaderBtn');
const sizeSelect = document.getElementById('sizeSelect');
const skinSelect = document.getElementById('skinSelect');

const hudScore = document.getElementById('score');
const hudPower = document.getElementById('power');
const hudTimer = document.getElementById('timer');
const pauseBtn = document.getElementById('pauseBtn');

const controls = document.querySelectorAll('.ctrl');
const startScreen = document.getElementById('menu');
const gameOverScreen = document.getElementById('gameOver');
const finalScore = document.getElementById('finalScore');
const playerName = document.getElementById('playerName');
const saveScoreBtn = document.getElementById('saveScore');
const retryBtn = document.getElementById('retryBtn');
const menuBtn = document.getElementById('menuBtn');

const leaderPanel = document.getElementById('leader');
const leaderBtnClose = document.getElementById('closeLead');
const leaderList = document.getElementById('leaderList');
const clearLead = document.getElementById('clearLead');

let gridSize = 20; // cells
let cell, cols, rows;
let snake = [], dir = {x:1,y:0}, nextDir = null;
let food = null;
let score = 0;
let loopInterval = 120; // ms
let loopTimer = null;
let running = false;
let elapsed = 0;
let timerTick = null;
let particles = [];
let power = {type:null, timeLeft:0}; // shield, slow, double
let skin = 'neon';
let speedMultiplier = 1;

// highscore localStorage key
const LS_KEY = 'rahul_snake_leader_v1';

// touch swipe handling
let touchStart = null;

// setup canvas size
function fitCanvas(){
  const maxW = Math.min(window.innerWidth - 32, 900);
  canvas.width = Math.floor(maxW);
  canvas.height = Math.floor((window.innerHeight * 0.64));
  // compute grid
  gridSize = parseInt(sizeSelect.value || 20, 10);
  cell = Math.floor(Math.min(canvas.width, canvas.height) / gridSize);
  cols = Math.floor(canvas.width / cell);
  rows = Math.floor(canvas.height / cell);
}
window.addEventListener('resize', ()=>{ fitCanvas(); render(); });

// ---------- Helpers ----------
function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
function playSound(s){ try{s.currentTime = 0; s.play();}catch(e){} }

// ---------- Game init ----------
function initGame(){
  fitCanvas();
  snake = [];
  const sx = Math.floor(cols/2), sy = Math.floor(rows/2);
  snake.push({x:sx, y:sy});
  dir = {x:1,y:0}; nextDir = null;
  spawnFood();
  score = 0;
  elapsed = 0;
  power = {type:null, timeLeft:0};
  speedMultiplier = 1;
  loopInterval = 120;
  hudUpdate();
  particles = [];
}

// spawn food or power-ups randomly
function spawnFood(){
  // 12% chance spawn power-up instead of food
  if(Math.random() < 0.12){
    const types = ['shield','slow','double','plus5'];
    const t = types[randInt(0, types.length-1)];
    food = {x: randEmptyX(), y: randEmptyY(), power: t};
  } else {
    food = {x: randEmptyX(), y: randEmptyY(), power: null};
  }
}

// find empty cell
function randEmptyX(){
  let x,y,ok=false;
  while(!ok){
    x = randInt(1, cols-2); y = randInt(1, rows-2);
    ok = !snake.some(s => s.x===x && s.y===y);
  }
  return x;
}
function randEmptyY(){ return randInt(1, rows-2); }

// HUD
function hudUpdate(){
  hudScore.textContent = 'Score: ' + score;
  hudPower.textContent = 'Power: ' + (power.type ? power.type.toUpperCase() : '—');
  hudTimer.textContent = 'Time: ' + Math.floor(elapsed) + 's';
}

// ---------- Main loop & input ----------
function startLoop(){
  if(loopTimer) clearInterval(loopTimer);
  loopTimer = setInterval(tick, Math.max(40, loopInterval * (1 / speedMultiplier)));
  if(timerTick) clearInterval(timerTick);
  timerTick = setInterval(()=>{ if(running){ elapsed += 1; if(power.timeLeft>0) power.timeLeft -= 1; if(power.timeLeft<=0){ power.type=null } hudUpdate(); } }, 1000);
  bgMusic.play().catch(()=>{});
}
function stopLoop(){
  if(loopTimer) clearInterval(loopTimer);
  if(timerTick) clearInterval(timerTick);
  loopTimer = null; timerTick = null;
}

// tick = game step
function tick(){
  if(!running) return;
  // apply nextDir if valid
  if(nextDir){
    if((nextDir.x !== -dir.x || nextDir.y !== -dir.y)) dir = nextDir;
    nextDir = null;
  }
  // speed power-ups
  let step = 1;
  if(power.type === 'slow') step = 0.5;
  // move head
  const head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};
  // wrap-around removed for classic — game over on wall
  // collision walls:
  if(head.x < 0 || head.y < 0 || head.x >= cols || head.y >= rows){
    if(power.type === 'shield'){ power.type = null; playSound(powerSound); } 
    else return gameOver();
  }
  // collision self
  for(let i=0;i<snake.length;i++){
    if(snake[i].x === head.x && snake[i].y === head.y){
      if(power.type === 'shield'){ power.type = null; playSound(powerSound); break; }
      else return gameOver();
    }
  }
  snake.unshift(head);
  // eat?
  if(head.x === food.x && head.y === food.y){
    // ate
    if(food.power){
      applyPower(food.power);
      playSound(powerSound);
    } else {
      score += (power.type==='double' ? 2 : 1);
      playSound(eatSound);
    }
    spawnParticles(head.x, head.y, food.power ? 'power' : 'eat');
    // speed up slightly
    loopInterval = Math.max(40, loopInterval - 2);
    // extra for plus5
    if(food.power === 'plus5'){ score += 5; }
    // grow (by not popping)
    spawnFood();
  } else {
    // normal move: pop tail
    snake.pop();
  }
  // update HUD
  hudUpdate();
  // speed multiplier affect local interval by restarting loop quickly (simple)
  stopLoop();
  startLoop();
}

// powers
function applyPower(t){
  if(t === 'shield'){ power.type = 'shield'; power.timeLeft = 8; }
  if(t === 'slow'){ power.type = 'slow'; power.timeLeft = 8; }
  if(t === 'double'){ power.type = 'double'; power.timeLeft = 12; }
  if(t === 'plus5'){ score += 5; }
}

// ---------- Particles ----------
function spawnParticles(cx, cy, kind){
  const px = cx * cell + cell/2, py = cy * cell + cell/2;
  for(let i=0;i<18;i++){
    const angle = Math.random()*Math.PI*2;
    const speed = (kind==='power'? 1.2 : 0.8) * (Math.random()*2 + 0.5);
    particles.push({x:px,y:py,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:30, color:(kind==='power'?'#ffd400':'#00ff66')});
  }
}
function updateParticles(){
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.08;
    p.life--;
    if(p.life <= 0) particles.splice(i,1);
  }
}
function drawParticles(){
  for(const p of particles){
    ctx.globalAlpha = Math.max(0, p.life/30);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, 3,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ---------- Render ----------
function render(){
  // background
  ctx.fillStyle = '#031018';
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // grid (optional subtle)
  ctx.strokeStyle = 'rgba(255,255,255,0.02)';
  for(let x=0;x<=cols;x++){
    ctx.beginPath(); ctx.moveTo(x*cell,0); ctx.lineTo(x*cell,rows*cell); ctx.stroke();
  }
  for(let y=0;y<=rows;y++){
    ctx.beginPath(); ctx.moveTo(0,y*cell); ctx.lineTo(cols*cell,y*cell); ctx.stroke();
  }

  // food
  if(food){
    const fx = food.x*cell, fy = food.y*cell;
    if(food.power){
      // power-up style
      ctx.fillStyle = '#ffd400';
      ctx.fillRect(fx+4, fy+4, cell-8, cell-8);
      ctx.fillStyle = '#111'; ctx.font = `${cell/2}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(food.power[0].toUpperCase(), fx+cell/2, fy+cell/2);
    } else {
      ctx.fillStyle = '#ff3b3b'; ctx.fillRect(fx+4, fy+4, cell-8, cell-8);
    }
  }

  // snake: head & body
  for(let i=snake.length-1;i>=0;i--){
    const s = snake[i];
    const x = s.x*cell, y = s.y*cell;
    if(i===0){
      // head style based on skin
      drawCellHead(x,y);
      // eyes
      ctx.fillStyle = '#111';
      const ex = dir.x===1 ? x+cell-6 : dir.x===-1 ? x+6 : x+cell/2;
      const ey = dir.y===1 ? y+cell-6 : dir.y===-1 ? y+6 : y+cell/2;
      ctx.beginPath(); ctx.arc(ex, ey, Math.max(2, cell/8), 0, Math.PI*2); ctx.fill();
    } else {
      drawCellBody(x,y, i);
    }
  }

  // particles
  drawParticles();
}

// draw head according to skin
function drawCellHead(x,y){
  if(skin === 'neon'){
    const g = ctx.createLinearGradient(x,y,x+cell,y+cell);
    g.addColorStop(0,'#00ff99'); g.addColorStop(1,'#00cc77');
    ctx.fillStyle = g; ctx.fillRect(x+1,y+1,cell-2,cell-2);
    ctx.strokeStyle = '#88ffcc'; ctx.strokeRect(x+1,y+1,cell-2,cell-2);
  } else if(skin==='red'){
    ctx.fillStyle='#ff6b6b'; ctx.fillRect(x+1,y+1,cell-2,cell-2); ctx.strokeStyle='#ffb3b3'; ctx.strokeRect(x+1,y+1,cell-2,cell-2);
  } else if(skin==='blue'){
    ctx.fillStyle='#36c6ff'; ctx.fillRect(x+1,y+1,cell-2,cell-2); ctx.strokeStyle='#bfefff'; ctx.strokeRect(x+1,y+1,cell-2,cell-2);
  } else if(skin==='gold'){
    ctx.fillStyle='#ffd166'; ctx.fillRect(x+1,y+1,cell-2,cell-2); ctx.strokeStyle='#fff0b3'; ctx.strokeRect(x+1,y+1,cell-2,cell-2);
  } else {
    ctx.fillStyle='#0f0'; ctx.fillRect(x+1,y+1,cell-2,cell-2);
  }
}
function drawCellBody(x,y,i){
  // gradient body
  const shade = 0.2 + Math.min(0.6, i/snake.length);
  if(skin==='neon') ctx.fillStyle = `rgba(${Math.floor(0+shade*20)},255,${Math.floor(153-shade*40)},1)`;
  else if(skin==='red') ctx.fillStyle = `rgba(255,${Math.floor(107+shade*50)},${Math.floor(107+shade*50)},1)`;
  else if(skin==='blue') ctx.fillStyle = `rgba(${Math.floor(54+shade*40)},${Math.floor(198+shade*20)},255,1)`;
  else if(skin==='gold') ctx.fillStyle = `rgba(255,${Math.floor(209+shade*10)},${Math.floor(102+shade*10)},1)`;
  else ctx.fillStyle = '#0f0';
  ctx.fillRect(x+1,y+1,cell-2,cell-2);
}

// ---------- Controls (keyboard & on-screen) ----------
window.addEventListener('keydown', (e)=>{
  if(!running) return;
  if(e.key === 'ArrowUp' || e.key === 'w') setDir(0,-1);
  if(e.key === 'ArrowDown' || e.key === 's') setDir(0,1);
  if(e.key === 'ArrowLeft' || e.key === 'a') setDir(-1,0);
  if(e.key === 'ArrowRight' || e.key === 'd') setDir(1,0);
  if(e.key === 'Escape') togglePause();
  if(e.code === 'Space'){ // nitro toggle - here as power
    if(power.type==='double'){ /* already */ } else { /* no-op */ }
  }
});
controls.forEach(b=>{
  b.addEventListener('pointerdown', ()=>{ const d=b.dataset.dir; if(d==='UP') setDir(0,-1); if(d==='DOWN') setDir(0,1); if(d==='LEFT') setDir(-1,0); if(d==='RIGHT') setDir(1,0); });
});

// swipe
canvas.addEventListener('touchstart', e=>{
  const t = e.touches[0];
  touchStart = {x:t.clientX, y:t.clientY};
});
canvas.addEventListener('touchend', e=>{
  if(!touchStart) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
  if(Math.abs(dx) > Math.abs(dy)){
    if(dx > 20) setDir(1,0); else if(dx < -20) setDir(-1,0);
  } else {
    if(dy > 20) setDir(0,1); else if(dy < -20) setDir(0,-1);
  }
  touchStart = null;
});

// set direction safely (no reverse)
function setDir(x,y){
  if(dir.x === -x && dir.y === -y) return;
  nextDir = {x,y};
  // apply immediately for responsive control
  dir = {x,y};
}

// ---------- Pause / Game Over / Leaderboard ----------
pauseBtn.addEventListener('click', togglePause);
function togglePause(){
  running = !running;
  if(running){ startLoop(); pauseBtn.textContent='Pause'; }
  else { stopLoop(); pauseBtn.textContent='Resume'; }
}

// Game over
function gameOver(){
  running = false; stopLoop(); playSound(crashSound);
  finalScore.textContent = 'Score: ' + score;
  gameOverScreen.style.display = 'block';
}

// retry & save
retryBtn.addEventListener('click', ()=>{
  gameOverScreen.style.display='none'; initGame(); startGame();
});
menuBtn.addEventListener('click', ()=>{
  gameOverScreen.style.display='none'; menu.style.display='block';
});

// leaderboard
leaderBtn.addEventListener('click', showLeader);
leaderBtnClose.addEventListener('click', ()=>{ leaderPanel.style.display='none'; menu.style.display='block'; });
clearLead.addEventListener('click', ()=>{ localStorage.removeItem(LS_KEY); renderLeader(); });

// save score
saveScoreBtn.addEventListener('click', ()=>{
  const name = (playerName.value || 'Player').slice(0,20);
  saveToLeader(name, score);
  saveScoreBtn.disabled = true;
  renderLeader();
});

// leaderboard render
function getLeader(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    return raw? JSON.parse(raw) : [];
  }catch(e){ return []; }
}
function saveToLeader(name, s){
  const arr = getLeader();
  arr.push({name, score:s, when: Date.now()});
  arr.sort((a,b)=>b.score-a.score);
  while(arr.length>20) arr.pop();
  localStorage.setItem(LS_KEY, JSON.stringify(arr));
}
function renderLeader(){
  const arr = getLeader().slice(0,5);
  leaderList.innerHTML = '';
  if(arr.length===0) leaderList.innerHTML='<li style="text-align:center;color:#999">No scores yet</li>';
  for(const r of arr){ const li = document.createElement('li'); li.innerHTML = `<span>${r.name}</span><strong>${r.score}</strong>`; leaderList.appendChild(li); }
}
function showLeader(){
  menu.style.display='none';
  leaderPanel.style.display='block';
  renderLeader();
}

// ---------- start / stop ----------
function startGame(){
  menu.style.display = 'none';
  gameOverScreen.style.display = 'none';
  initGame();
  running = true;
  // pick skin
  skin = skinSelect.value || 'neon';
  startLoop();
  playSound(bgMusic);
}
playBtn.addEventListener('click', startGame);

// init wrapper
function initGame(){
  fitCanvas();
  // set vertices
  snake = [];
  const sx = Math.floor(cols/2), sy = Math.floor(rows/2);
  snake.push({x:sx, y:sy});
  dir = {x:1,y:0}; nextDir = null;
  spawnFood();
  score = 0;
  elapsed = 0;
  hudUpdate();
  loopInterval = 120;
  power = {type:null, timeLeft:0};
  particles = [];
  render();
}

// loop control
function startLoop(){ if(loopTimer) clearInterval(loopTimer); loopTimer = setInterval(()=>{ tick(); render(); updateParticles(); }, Math.max(30, loopInterval / (speedMultiplier))); if(timerTick) clearInterval(timerTick); timerTick = setInterval(()=>{ if(running) elapsed++; hudUpdate(); }, 1000); }
function stopLoop(){ if(loopTimer) clearInterval(loopTimer); if(timerTick) clearInterval(timerTick); loopTimer = null; timerTick = null; }

// ---------- runtime tick implemented above as tick() ----------
let nextDir = null;
function tick(){
  if(!running) return;
  // move
  if(nextDir){ if(!(nextDir.x === -dir.x && nextDir.y === -dir.y)) dir = nextDir; nextDir = null; }
  const head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};
  // walls
  if(head.x < 0 || head.y < 0 || head.x >= cols || head.y >= rows){
    if(power.type==='shield'){ power.type = null; playSound(powerSound); } else return gameOver();
  }
  // self
  for(let i=0;i<snake.length;i++){
    if(snake[i].x === head.x && snake[i].y === head.y){
      if(power.type==='shield'){ power.type=null; playSound(powerSound); break; } else return gameOver();
    }
  }
  snake.unshift(head);
  if(head.x === food.x && head.y === food.y){
    // ate
    if(food.power) applyPower(food.power);
    else score += (power.type==='double'? 2:1);
    spawnParticles(head.x, head.y, food.power ? 'power':'eat');
    playSound( food.power ? powerSound : eatSound );
    spawnFood();
    loopInterval = Math.max(40, loopInterval - 3);
  } else {
    snake.pop();
  }
  hudUpdate();
  // decrease power timer
  if(power.type){
    power.timeLeft -= 1/ (1000/Math.max(30, loopInterval));
    if(power.timeLeft <= 0) power.type = null;
  }
}

// ---------- particles update 
