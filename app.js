// Simple webcam-based detector using TensorFlow.js COCO-SSD in the browser.
// GitHub Pages is HTTPS, so getUserMedia() will work after permission.

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: false });
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusEl = document.getElementById('status');
const showAll = document.getElementById('showAll');

// Classes to highlight as "dangerous-ish"
const DANGEROUS = new Set(['knife', 'scissors', 'baseball bat']);

// Globals
let model = null;
let stream = null;
let running = false;
let rafId = null;

// Load model ASAP
cocoSsd.load({ base: 'lite_mobilenet_v2' }) // smaller, faster
  .then(m => {
    model = m;
    statusEl.textContent = 'Model loaded. Click “Start Camera”.';
  })
  .catch(err => {
    console.error(err);
    statusEl.textContent = 'Failed to load model.';
  });

// Start camera
startBtn.addEventListener('click', async () => {
  if (!model) { statusEl.textContent = 'Still loading model…'; return; }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'environment' // use rear cam on phones
      },
      audio: false
    });
    video.srcObject = stream;

    await video.play();

    // Size canvas to video
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    running = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    statusEl.textContent = 'Camera running. Detecting…';

    loop();
  } catch (e) {
    console.error(e);
    statusEl.textContent = 'Could not access camera. Check permissions.';
  }
});

// Stop camera
stopBtn.addEventListener('click', () => {
  running = false;
  if (rafId) cancelAnimationFrame(rafId);
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  startBtn.disabled = false;
  stopBtn.disabled = true;
  statusEl.textContent = 'Camera stopped.';
});

async function loop() {
  if (!running) return;

  // Draw current frame
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Run detection
  let predictions = [];
  try {
    predictions = await model.detect(video); // returns [{class, score, bbox:[x,y,w,h]}, ...]
  } catch (e) {
    console.error(e);
  }

  // Optionally filter to dangerous classes
  const filtered = showAll.checked
    ? predictions
    : predictions.filter(p => DANGEROUS.has(p.class));

  drawBoxes(filtered);

  rafId = requestAnimationFrame(loop);
}

function drawBoxes(preds) {
  for (const p of preds) {
    const [x, y, w, h] = p.bbox;
    const isDanger = DANGEROUS.has(p.class);
    const color = isDanger ? '#f87171' : '#7dd3fc';
    const thick = isDanger ? 4 : 2;

    // Box
    ctx.strokeStyle = color;
    ctx.lineWidth = thick;
    ctx.strokeRect(x, y, w, h);

    // Label
    const label = `${p.class} ${(p.score * 100).toFixed(1)}%`;
    const padX = 8, padY = 6;
    ctx.font = '600 14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial';
    const textW = ctx.measureText(label).width;
    const boxW = textW + padX * 2;
    const boxH = 22;

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x, Math.max(0, y - boxH), boxW, boxH);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, x + padX, Math.max(12, y - 6));
  }

  // Status corner (FPS-ish)
  // (Using rough timestamp-based estimation)
  const now = performance.now();
  if (!drawBoxes.prev) drawBoxes.prev = now;
  const fps = 1000 / Math.max(1, now - drawBoxes.prev);
  drawBoxes.prev = now;

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(8, 8, 110, 26);
  ctx.fillStyle = '#e6ecf2';
  ctx.font = '600 14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial';
  ctx.fillText(`~${fps.toFixed(1)} FPS`, 16, 26);
}
