const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
let width = canvas.width = window.innerWidth;
let height = canvas.height = window.innerHeight * 0.65;

let x = 50, y = 300, velX = 0, velY = 0, angle = 0;
let gravity = 0.6, ground = height - 60;
let distance = 0, playing = false;

const scoreTxt = document.getElementById("score");
const startScreen = document.getElementById("startScreen");
const gameOver = document.getElementById("gameOver");
const finalScore = document.getElementById("finalScore");

function resetGame() {
  x = 50;
  y = 300;
  velX = 0;
  velY = 0;
  angle = 0;
  distance = 0;
}

function drawBike() {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.fillStyle = "#ff3131";
  ctx.fillRect(-30, -15, 60, 15);

  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(-25, 0, 15, 0, Math.PI * 2);
  ctx.arc(25, 0, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function update() {
  if (!playing) return;

  velY += gravity;
  y += velY;
  x += velX;
  distance = Math.floor(x / 10);
  scoreTxt.textContent = "Distance: " + distance + " m";

  if (y > ground) {
    y = ground;
    velY = -12;
  }

  if (x < 0) x = 0;

  if (y >= ground + 80) {
    playing = false;
    gameOver.style.display = "block";
    finalScore.textContent = "Distance: " + distance + " m";
  }
}

function loop() {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#3ba80f";
  ctx.fillRect(0, ground, width, height);

  update();
  drawBike();
  requestAnimationFrame(loop);
}
loop();

// Controls
document.getElementById("playBtn").onclick = () => {
  startScreen.style.display = "none";
  playing = true;
};

document.getElementById("restartBtn").onclick = () => {
  resetGame();
  gameOver.style.display = "none";
  playing = true;
};

document.getElementById("leftBtn").onmousedown = () => angle -= 0.1;
document.getElementById("rightBtn").onmousedown = () => velX += 1;

window.onkeydown = (e) => {
  if (e.code === "ArrowRight") velX += 1;
  if (e.code === "Space") velY = -12;
};
