// Rahul's Monster Ride — upgraded realistic-ish 3D racer using Three.js
// Replace existing game.js with this file

const canvas = document.getElementById('gameCanvas');
const playBtn = document.getElementById('playBtn');
const restartBtn = document.getElementById('restartBtn');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOver');
const finalScore = document.getElementById('finalScore');
const scoreEl = document.getElementById('score');
const speedEl = document.getElementById('speed');
const nitroEl = document.getElementById('nitro');

const accelBtn = document.getElementById('accelBtn');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const brakeBtn = document.getElementById('brakeBtn');

let scene, camera, renderer, clock, car, roadSegments = [], obstacles = [], cameraPivot;
let playing = false, state = {};
let audioCtx, engineOsc, engineGain;
const MAX_NITRO = 100;

function initState(){
  state = {
    speed: 0,
    maxSpeed: 160,
    accel: 220,
    brake: 360,
    steer: 0,
    yaw: 0,
    distance: 0,
    accelerating: false,
    braking: false,
    nitro: MAX_NITRO,
    nitroActive: false
  };
}

function initThree(){
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87cefa);
  scene.fog = new THREE.FogExp2(0x87cefa, 0.0007);

  clock = new THREE.Clock();

  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || Math.floor(window.innerHeight * 0.72);
  camera = new THREE.PerspectiveCamera(60, w/h, 0.1, 10000);

  // renderer
  renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
  renderer.setSize(w,h);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
  hemi.position.set(0,50,0); scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(-30, 60, -10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048,2048);
  sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 200;
  scene.add(sun);

  // ground plane (large)
  const grassMat = new THREE.MeshLambertMaterial({ color: 0x1f8b2f });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), grassMat);
  ground.rotation.x = -Math.PI/2;
  ground.position.y = -0.1;
  ground.receiveShadow = true;
  scene.add(ground);

  // procedural textured road using canvas texture
  const roadCanvas = document.createElement('canvas');
  roadCanvas.width = 1024; roadCanvas.height = 1024;
  const rctx = roadCanvas.getContext('2d');
  rctx.fillStyle = '#333333'; rctx.fillRect(0,0,1024,1024);
  // draw dashed line center
  rctx.fillStyle = '#f0e68c';
  for(let i=0;i<1024;i+=80) rctx.fillRect(480, i, 32, 20);
  const roadTex = new THREE.CanvasTexture(roadCanvas);
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
  roadTex.repeat.set(6, 30);

  // create road segments
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, metalness:0.05, roughness:0.8 });
  for(let i=0;i<50;i++){
    const seg = new THREE.Mesh(new THREE.BoxGeometry(12, 0.2, 40), roadMat);
    seg.position.set(0,0, i*40);
    seg.receiveShadow = true;
    seg.castShadow = false;
    scene.add(seg);
    roadSegments.push(seg);
  }

  // side barriers (simple low curbs)
  const curbMat = new THREE.MeshStandardMaterial({ color:0x2e2e2e, roughness:0.7 });
  const leftCurb = new THREE.Mesh(new THREE.BoxGeometry(80, 0.3, 2000), curbMat);
  leftCurb.position.set(-46, 0.05, 600); leftCurb.receiveShadow = true;
  scene.add(leftCurb);
  const rightCurb = leftCurb.clone(); rightCurb.position.set(46, 0.05, 600); scene.add(rightCurb);

  // create car body + wheels
  const carBodyMat = new THREE.MeshStandardMaterial({ color:0xffd400, metalness:0.3, roughness:0.35 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 4.2), carBodyMat);
  body.position.set(0, 1.2, -8); body.castShadow = true; body.receiveShadow = false;

  const wheelMat = new THREE.MeshStandardMaterial({ color:0x111111, metalness:0.2, roughness:0.8 });
  const wheelLF = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.55, 16), wheelMat);
  wheelLF.rotation.z = Math.PI/2; wheelLF.position.set(-0.9, 0.5, -7);

  const wheelRF = wheelLF.clone(); wheelRF.position.set(0.9, 0.5, -7);
  const wheelLB = wheelLF.clone(); wheelLB.position.set(-0.9, 0.5, -9.2);
  const wheelRB = wheelLF.clone(); wheelRB.position.set(0.9, 0.5, -9.2);

  car = new THREE.Object3D();
  car.add(body, wheelLF, wheelRF, wheelLB, wheelRB);
  scene.add(car);

  // camera pivot so camera follows smoothly
  cameraPivot = new THREE.Object3D(); scene.add(cameraPivot);
  cameraPivot.add(camera);
  camera.position.set(0, 5.6, -12);
  camera.lookAt(car.position);

  window.addEventListener('resize', onWindowResize);

  // audio init
  initAudio();
}

function initAudio(){
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    engineOsc = audioCtx.createOscillator();
    engineGain = audioCtx.createGain();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 80;
    engineOsc.connect(engineGain);
    engineGain.connect(audioCtx.destination);
    engineGain.gain.value = 0;
    engineOsc.start();
  } catch(e) {
    audioCtx = null;
  }
}

function updateEngineSound(){
  if(!audioCtx) return;
  // map speed to frequency/gain
  const f = 60 + (state.speed / state.maxSpeed) * 800;
  engineOsc.frequency.exponentialRampToValueAtTime(Math.max(60,f), audioCtx.currentTime + 0.05);
  engineGain.gain.linearRampToValueAtTime(Math.min(0.6, 0.05 + (state.speed/state.maxSpeed) * 0.55), audioCtx.currentTime + 0.05);
  if(state.nitroActive) engineGain.gain.value *= 1.6;
}

function spawnObstacle(zPos){
  const mat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
  const w = THREE.MathUtils.randInt(1,3);
  const h = THREE.MathUtils.randInt(1,2);
  const obs = new THREE.Mesh(new THREE.BoxGeometry(w, h, 2.5), mat);
  const lane = THREE.MathUtils.randInt(-1,1) * 3; // lanes
  obs.position.set(lane, h/2, zPos);
  obs.castShadow = true;
  obs.receiveShadow = false;
  scene.add(obs);
  obstacles.push(obs);
}

function resetGame(){
  // remove obstacles
  for(let o of obstacles) scene.remove(o);
  obstacles = [];
  // reset segments
  for(let i=0;i<roadSegments.length;i++) roadSegments[i].position.z = i*40;
  car.position.set(0,1.2,-8); car.rotation.set(0,0,0);
  initState();
  playing = false;
  startScreen.style.display = 'block';
  gameOverScreen.style.display = 'none';
  updateHUD();
}

function updateHUD(){
  scoreEl.textContent = 'Distance: ' + Math.floor(state.distance) + ' m';
  speedEl.textContent = 'Speed: ' + Math.floor(state.speed) + ' km/h';
  nitroEl.textContent = 'Nitro: ' + Math.max(0, Math.floor(state.nitro)) + '%';
}

function onWindowResize(){
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || Math.floor(window.innerHeight * 0.72);
  camera.aspect = w/h;
  camera.updateProjectionMatrix();
  renderer.setSize(w,h);
}

let lastSpawnTime = 0;
function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.06);

  if(playing){
    // accelerate / brake
    if(state.accelerating) state.speed += state.accel * dt;
    else state.speed -= state.accel * 0.35 * dt;
    if(state.braking) state.speed -= state.brake * dt;

    // nitro: hold space or brakeBtn for nitro boost (uses nitro meter)
    if(state.nitroActive && state.nitro > 0){
      state.speed += 600 * dt; // big boost
      state.nitro -= 28 * dt;
    } else {
      state.nitroActive = false;
      state.nitro = Math.min(MAX_NITRO, state.nitro + 8 * dt);
    }

    state.speed = THREE.MathUtils.clamp(state.speed, 0, state.maxSpeed + 60);
    // steering
    if(state.steer !== 0) state.yaw += state.steer * 1.2 * dt;
    // small auto-centering
    state.yaw *= 0.992;

    // move car forward in world -z direction relative to car orientation
    const forward = new THREE.Vector3(0,0,-1).applyQuaternion(car.quaternion);
    car.position.addScaledVector(forward, state.speed * 0.02 * dt * 60);

    // lateral position influenced by yaw (steering)
    car.position.x += state.steer * 2.2 * dt * (state.speed/40 + 0.8);

    // clamp x to road width
    car.position.x = THREE.MathUtils.clamp(car.position.x, -5.5, 5.5);

    // camera follows with slight lag and shake proportional to speed
    const camTarget = new THREE.Vector3().copy(car.position).add(new THREE.Vector3(0,4,14));
    cameraPivot.position.lerp(camTarget, 0.08);
    camera.lookAt(car.position.x, car.position.y + 1.2, car.position.z);

    // animate wheels rotation
    car.children.forEach(ch => {
      if(ch.geometry && ch.geometry.type === 'CylinderGeometry') ch.rotation.x -= state.speed * 0.03 * dt * 60;
    });

    // move road segments backward to simulate forward movement
    for(let seg of roadSegments){
      seg.position.z -= state.speed * 0.02 * dt * 60;
      if(seg.position.z < -80) seg.position.z += roadSegments.length * 40;
    }

    // spawn obstacles occasionally
    lastSpawnTime += dt;
    if(lastSpawnTime > 0.35){
      lastSpawnTime = 0;
      if(Math.random() < 0.35) {
        const zPos = car.position.z + 160 + Math.random()*240;
        spawnObstacle(zPos);
      }
    }

    // obstacles collision check
    for(let i=obstacles.length-1;i>=0;i--){
      const o = obstacles[i];
      // remove behind car
      if(o.position.z < car.position.z - 40){ scene.remove(o); obstacles.splice(i,1); continue; }
      const d = o.position.distanceTo(car.position);
      if(d < 2.2 + (o.scale ? o.scale.x : 0)) {
        // collision -> crash
        endGame();
        break;
      }
    }

    // update distance based on forward progress
    state.distance += state.speed * 0.02 * dt * 60;
    updateHUD();
    updateEngineSound(); // audio
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

  window.addEventListener('keydown', (e)=>{
    if(e.code === 'ArrowUp' || e.key === 'w') state.accelerating = true;
    if(e.code === 'ArrowDown' || e.key === 's') state.braking = true;
    if(e.code === 'ArrowLeft' || e.key === 'a') state.steer = -1;
    if(e.code === 'ArrowRight' || e.key === 'd') state.steer = 1;
    if(e.code === 'Space') {
      // nitro on hold
      if(state.nitro > 6) state.nitroActive = true;
    }
    // unlock audio context on first input
    if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  });

  window.addEventListener('keyup', (e)=>{
    if(e.code === 'ArrowUp' || e.key === 'w') state.accelerating = false;
    if(e.code === 'ArrowDown' || e.key === 's') state.braking = false;
    if((e.code === 'ArrowLeft' || e.key === 'a') || (e.code === 'ArrowRight' || e.key === 'd')) state.steer = 0;
    if(e.code === 'Space') state.nitroActive = false;
  });

  // mobile buttons
  accelBtn.addEventListener('pointerdown', ()=> state.accelerating = true);
  accelBtn.addEventListener('pointerup', ()=> state.accelerating = false);
  accelBtn.addEventListener('pointerleave', ()=> state.accelerating = false);

  brakeBtn.addEventListener('pointerdown', ()=> state.nitroActive = true);
  brakeBtn.addEventListener('pointerup', ()=> state.nitroActive = false);
  brakeBtn.addEventListener('pointerleave', ()=> state.nitroActive = false);

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
  // resume audio on gesture
  if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
});

restartBtn.addEventListener('click', ()=>{
  resetGame();
});

window.addEventListener('resize', ()=> {
  if(renderer) onWindowResize();
});

// init & start
initThree();
initState();
attachInput();
resetGame();
animate();
