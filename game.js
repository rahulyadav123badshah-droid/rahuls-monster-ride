// Simple 3D racing using Three.js - no external models, primitives only
const canvas = document.getElementById('gameCanvas');
const playBtn = document.getElementById('playBtn');
const restartBtn = document.getElementById('restartBtn');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOver');
const finalScore = document.getElementById('finalScore');
const scoreEl = document.getElementById('score');
const speedEl = document.getElementById('speed');

const accelBtn = document.getElementById('accelBtn');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const brakeBtn = document.getElementById('brakeBtn');

let scene, camera, renderer;
let car, roadSegments = [], obstacles = [];
let clock = new THREE.Clock();
let playing = false;

let state = {
  speed: 0,           // units per second
  maxSpeed: 140,     // arbitrary units
  accel: 60,
  brake: 140,
  steer: 0,
  yaw: 0,
  distance: 0
};

function initThree() {
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x87cefa, 0.0012);

  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 10000);
  camera.position.set(0, 6, -14);
  camera.lookAt(0,0,0);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(window.devicePixelRatio ? window.devicePixelRatio : 1);

  // light
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
  hemi.position.set(0, 20, 0);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(-5,10,5);
  scene.add(dir);

  // road: create long segments that we recycle
  const roadMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
  for(let i=0;i<30;i++){
    const seg = new THREE.Mesh(new THREE.BoxGeometry(12, 0.1, 40), roadMaterial);
    seg.position.set(0,0, i * 40);
    scene.add(seg);
    roadSegments.push(seg);
    // lane lines
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xf0e68c });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.4,0.05,8), lineMat);
    stripe.position.set(0,0.06, i * 40 + 6);
    scene.add(stripe);
  }

  // roadside grass
  const grassMat = new THREE.MeshLambertMaterial({color:0x2f9b2f});
  const leftGrass = new THREE.Mesh(new THREE.BoxGeometry(80,0.1,1200), grassMat);
  leftGrass.position.set(-46, -0.05, 600/2);
  scene.add(leftGrass);
  const rightGrass = leftGrass.clone();
  rightGrass.position.set(46, -0.05, 600/2);
  scene.add(rightGrass);

  // car (box)
  const carMat = new THREE.MeshPhongMaterial({ color: 0xffd400 });
  car = new THREE.Mesh(new THREE.BoxGeometry(2.6,1.0,4), carMat);
  car.position.set(0, 1.2, -8);
  scene.add(car);

  // camera offset pivot
  cameraPivot = new THREE.Object3D();
  cameraPivot.position.copy(car.position);
  scene.add(cameraPivot);
  cameraPivot.add(camera);
  camera.position.set(0,6,-12);
  camera.lookAt(car.position);

  window.addEventListener('resize', onWindowResize);
}

function onWindowResize(){
  const w = canvas.clientWidth, h = canvas.clientHeight;
  camera.aspect = w/h;
  camera.updateProjectionMatrix();
  renderer.setSize(w,h);
}

function spawnObstacle(zPos){
  const mat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
  const w = THREE.MathUtils.randInt(1,3);
  const h = THREE.MathUtils.randInt(1,2);
  const obs = new THREE.Mesh(new THREE.BoxGeometry(w, h, 2.5), mat);
  const lane = THREE.MathUtils.randInt(-1,1) * 3.5; // left, center, right
  obs.position.set(lane, h/2, zPos);
  scene.add(obs);
  obstacles.push(obs);
}

function resetGame(){
  // remove obstacles
  for(let o of obstacles) scene.remove(o);
  obstacles = [];
  state.speed = 0;
  state.distance = 0;
  state.yaw = 0;
  playing = false;
  // reset car
  car.position.set(0,1.2,-8);
  car.rotation.set(0,0,0);
  // reposition road segments
  for(let i=0;i<roadSegments.length;i++){
    roadSegments[i].position.z = i * 40;
  }
  startScreen.style.display = 'block';
  gameOverScreen.style.display = 'none';
  updateHud();
}

function updateHud(){
  scoreEl.textContent = 'Distance: ' + Math.floor(state.distance) + ' m';
  speedEl.textContent = 'Speed: ' + Math.floor(state.speed) + ' km/h';
}

let lastSpawn = 60;

function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if(playing){
    // basic acceleration / braking
    if(state.accelerating) state.speed += state.accel * dt;
    else state.speed -= (state.accel*0.4) * dt;

    if(state.braking) state.speed -= state.brake * dt;

    state.speed = THREE.MathUtils.clamp(state.speed, 0, state.maxSpeed);

    // steering affects yaw
    state.yaw += state.steer * 1.5 * dt;
    car.rotation.y = state.yaw * 0.9;

    // forward movement along local -z
    const forward = new THREE.Vector3(0,0,-1).applyQuaternion(car.quaternion);
    car.position.addScaledVector(forward, state.speed * 0.02 * dt * 60);

    // keep car on lanes (x damping)
    car.position.x += -car.position.x * 2 * dt * 0.5;

    // move camera pivot to car
    cameraPivot.position.lerp(car.position, 0.12);

    // move road segments behind and recycle
    for(let seg of roadSegments){
      seg.position.z -= state.speed * 0.02 * dt * 60;
      if(seg.position.z < -80){
        seg.position.z += roadSegments.length * 40;
      }
    }

    // obstacles move relative: actually they are static in world; we'll remove those behind
    for(let i=obstacles.length-1;i>=0;i--){
      if(obstacles[i].position.z < car.position.z - 50){
        scene.remove(obstacles[i]); obstacles.splice(i,1);
      } else {
        // collision simple box distance
        const d = obstacles[i].position.distanceTo(car.position);
        if(d < 3.2){
          // collision
          endGame();
        }
      }
    }

    // spawn obstacles ahead
    if(Math.random() < 0.02 + (state.distance/10000)){
      const zPos = car.position.z + 160 + Math.random()*160;
      spawnObstacle(zPos);
    }

    // update distance
    state.distance += state.speed * 0.02 * dt * 60;
    updateHud();
  }

  renderer.render(scene, camera);
}

function endGame(){
  playing = false;
  finalScore.textContent = 'Distance: ' + Math.floor(state.distance) + ' m';
  gameOverScreen.style.display = 'block';
}

function attachInput(){
  state.accelerating = false;
  state.braking = false;
  state.steer = 0;

  // keyboard
  window.addEventListener('keydown', (e)=>{
    if(!playing) return;
    if(e.key === 'ArrowUp') state.accelerating = true;
    if(e.key === 'ArrowDown' || e.key === ' ') state.braking = true;
    if(e.key === 'ArrowLeft' || e.key === 'a') state.steer = -1;
    if(e.key === 'ArrowRight' || e.key === 'd') state.steer = 1;
  });
  window.addEventListener('keyup', (e)=>{
    if(e.key === 'ArrowUp') state.accelerating = false;
    if(e.key === 'ArrowDown' || e.key === ' ') state.braking = false;
    if(e.key === 'ArrowLeft' || e.key === 'a') state.steer = 0;
    if(e.key === 'ArrowRight' || e.key === 'd') state.steer = 0;
  });

  // mobile buttons
  accelBtn.addEventListener('pointerdown', ()=> state.accelerating = true);
  accelBtn.addEventListener('pointerup', ()=> state.accelerating = false);
  accelBtn.addEventListener('pointerleave', ()=> state.accelerating = false);

  brakeBtn.addEventListener('pointerdown', ()=> state.braking = true);
  brakeBtn.addEventListener('pointerup', ()=> state.braking = false);
  brakeBtn.addEventListener('pointerleave', ()=> state.braking = false);

  leftBtn.addEventListener('pointerdown', ()=> state.steer = -1);
  leftBtn.addEventListener('pointerup', ()=> state.steer = 0);
  rightBtn.addEventListener('pointerdown', ()=> state.steer = 1);
  rightBtn.addEventListener('pointerup', ()=> state.steer = 0);
}

playBtn.addEventListener('click', ()=>{
  startScreen.style.display = 'none';
  playing = true;
  state.speed = 0;
  state.distance = 0;
});

restartBtn.addEventListener('click', ()=>{
  resetGame();
});

window.addEventListener('resize', ()=>{
  renderer && onWindowResize();
});

// init
initThree();
attachInput();
resetGame();
animate();

