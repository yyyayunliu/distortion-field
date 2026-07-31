import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js';

const video = document.querySelector('#camera');
const canvas = document.querySelector('#stage');
const permission = document.querySelector('#permission');
const startButton = document.querySelector('#startCamera');
const switchButton = document.querySelector('#switchCamera');
const controls = document.querySelector('#controls');
const toggleControlsButton = document.querySelector('#toggleControls');
const currentModeLabel = document.querySelector('#currentModeLabel');
const statusEl = document.querySelector('#status');
const modeButtons = [...document.querySelectorAll('.mode')];
const strengthInput = document.querySelector('#strength');
const radiusInput = document.querySelector('#radius');
const frequencyInput = document.querySelector('#frequency');
const strengthValue = document.querySelector('#strengthValue');
const radiusValue = document.querySelector('#radiusValue');
const frequencyValue = document.querySelector('#frequencyValue');
const randomButton = document.querySelector('#randomize');
const resetButton = document.querySelector('#reset');
const beforeButton = document.querySelector('#before');
const photoModeButton = document.querySelector('#photoMode');
const videoModeButton = document.querySelector('#videoMode');
const shutterButton = document.querySelector('#shutter');
const recordingBadge = document.querySelector('#recordingBadge');
const recordingTime = document.querySelector('#recordingTime');
const flash = document.querySelector('#flash');
const openLastButton = document.querySelector('#openLast');
const lastThumb = document.querySelector('#lastThumb');
const preview = document.querySelector('#preview');
const previewFrame = document.querySelector('#previewFrame');
const previewTitle = document.querySelector('#previewTitle');
const previewMeta = document.querySelector('#previewMeta');
const closePreviewButton = document.querySelector('#closePreview');
const savePreviewButton = document.querySelector('#savePreview');
const sharePreviewButton = document.querySelector('#sharePreview');

let stream = null;
let facingMode = 'environment';
let renderer;
let scene;
let renderCamera;
let material;
let videoTexture;
let ready = false;
let statusTimer;
let captureMode = 'photo';
let mediaRecorder = null;
let recordingChunks = [];
let recordingStartedAt = 0;
let recordingTimer = null;
let recordingMimeType = '';
let lastCapture = null;
let lastObjectUrl = '';
let previewObjectUrl = '';

const defaults = {
  mode: 0,
  strength: 0.24,
  radius: 0.42,
  frequency: 4.0,
  center: [0.5, 0.5]
};

const MAX_RECORDING_MS = 30_000;

function showStatus(message, duration = 2200) {
  statusEl.textContent = message;
  statusEl.classList.add('visible');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => statusEl.classList.remove('visible'), duration);
}

function setOutputs() {
  strengthValue.value = Number(strengthInput.value).toFixed(2);
  radiusValue.value = Number(radiusInput.value).toFixed(2);
  frequencyValue.value = Number(frequencyInput.value).toFixed(1);
}

function updateUniforms() {
  if (!material) return;
  material.uniforms.uStrength.value = Number(strengthInput.value);
  material.uniforms.uRadius.value = Number(radiusInput.value);
  material.uniforms.uFrequency.value = Number(frequencyInput.value);
  setOutputs();
}

async function startCamera() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera access is not available in this browser.');
    }

    if (isRecording()) stopRecording();
    if (stream) stream.getTracks().forEach((track) => track.stop());

    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    });

    video.srcObject = stream;
    await video.play();
    permission.classList.add('hidden');

    if (!renderer) initThree();
    updateVideoSize();
    ready = true;
    showStatus('Tap the image to move the distortion center.');
  } catch (error) {
    console.error(error);
    showStatus(error.message || 'Unable to access the camera.', 5000);
  }
}

function initThree() {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  scene = new THREE.Scene();
  renderCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  videoTexture = new THREE.VideoTexture(video);
  videoTexture.colorSpace = THREE.SRGBColorSpace;
  videoTexture.minFilter = THREE.LinearFilter;
  videoTexture.magFilter = THREE.LinearFilter;

  material = new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: videoTexture },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uVideoSize: { value: new THREE.Vector2(1080, 1920) },
      uCenter: { value: new THREE.Vector2(...defaults.center) },
      uStrength: { value: defaults.strength },
      uRadius: { value: defaults.radius },
      uFrequency: { value: defaults.frequency },
      uMode: { value: defaults.mode },
      uTime: { value: 0 },
      uBefore: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D uTexture;
      uniform vec2 uResolution;
      uniform vec2 uVideoSize;
      uniform vec2 uCenter;
      uniform float uStrength;
      uniform float uRadius;
      uniform float uFrequency;
      uniform float uMode;
      uniform float uTime;
      uniform float uBefore;

      vec2 coverUv(vec2 uv, vec2 screenSize, vec2 videoSize) {
        float screenRatio = screenSize.x / screenSize.y;
        float videoRatio = videoSize.x / videoSize.y;
        vec2 scale = vec2(1.0);
        if (screenRatio > videoRatio) scale.y = videoRatio / screenRatio;
        else scale.x = screenRatio / videoRatio;
        return (uv - 0.5) * scale + 0.5;
      }

      vec2 bend(vec2 uv) {
        float y = uv.y - 0.5;
        float influence = 1.0 - smoothstep(0.0, uRadius, abs(y));
        uv.x += sin(y * uFrequency * 3.1415926) * uStrength * 0.35 * influence;
        return uv;
      }

      vec2 bulge(vec2 uv) {
        vec2 p = uv - uCenter;
        float d = length(p);
        float influence = 1.0 - smoothstep(0.0, uRadius, d);
        float factor = 1.0 - uStrength * 0.75 * influence;
        return uCenter + p * factor;
      }

      vec2 twist(vec2 uv) {
        vec2 p = uv - uCenter;
        float d = length(p);
        float influence = 1.0 - smoothstep(0.0, uRadius, d);
        float a = atan(p.y, p.x) + uStrength * 5.0 * influence;
        return uCenter + vec2(cos(a), sin(a)) * d;
      }

      vec2 wave(vec2 uv) {
        float influence = 1.0 - smoothstep(0.0, uRadius, distance(uv, uCenter));
        uv.x += sin((uv.y + uTime * 0.08) * uFrequency * 6.28318) * uStrength * 0.08 * influence;
        uv.y += cos((uv.x - uTime * 0.06) * uFrequency * 6.28318) * uStrength * 0.05 * influence;
        return uv;
      }

      void main() {
        vec2 uv = coverUv(vUv, uResolution, uVideoSize);
        vec2 warped = uv;
        if (uBefore < 0.5) {
          if (uMode < 0.5) warped = bend(uv);
          else if (uMode < 1.5) warped = bulge(uv);
          else if (uMode < 2.5) warped = twist(uv);
          else warped = wave(uv);
        }
        warped = clamp(warped, vec2(0.001), vec2(0.999));
        gl_FragColor = texture2D(uTexture, warped);
      }
    `
  });

  const geometry = new THREE.PlaneGeometry(2, 2);
  scene.add(new THREE.Mesh(geometry, material));
  animate();
}

function updateVideoSize() {
  if (!material || !video.videoWidth || !video.videoHeight) return;
  material.uniforms.uVideoSize.value.set(video.videoWidth, video.videoHeight);
}

function animate(time = 0) {
  requestAnimationFrame(animate);
  if (!renderer || !material) return;
  material.uniforms.uTime.value = time * 0.001;
  renderer.render(scene, renderCamera);
}

function resize() {
  if (!renderer || !material) return;
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
}

function setMode(mode) {
  modeButtons.forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.mode) === mode);
  });
  if (material) material.uniforms.uMode.value = mode;
  const activeButton = modeButtons.find((button) => Number(button.dataset.mode) === mode);
  if (currentModeLabel && activeButton) currentModeLabel.textContent = activeButton.textContent;
}

function reset() {
  strengthInput.value = defaults.strength;
  radiusInput.value = defaults.radius;
  frequencyInput.value = defaults.frequency;
  setMode(defaults.mode);
  if (material) material.uniforms.uCenter.value.set(...defaults.center);
  updateUniforms();
}

function randomize() {
  const mode = Math.floor(Math.random() * 4);
  strengthInput.value = (0.15 + Math.random() * 0.65).toFixed(2);
  radiusInput.value = (0.22 + Math.random() * 0.65).toFixed(2);
  frequencyInput.value = (1.5 + Math.random() * 8.5).toFixed(1);
  setMode(mode);
  if (material) {
    material.uniforms.uCenter.value.set(
      0.18 + Math.random() * 0.64,
      0.22 + Math.random() * 0.56
    );
  }
  updateUniforms();
}

function setBefore(active) {
  if (material) material.uniforms.uBefore.value = active ? 1 : 0;
}

function setCenterFromPointer(event) {
  if (
    !ready ||
    !material ||
    event.target.closest('.controls') ||
    event.target.closest('.capture-dock') ||
    event.target.closest('.preview') ||
    event.target.closest('.permission-panel')
  ) return;

  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = 1 - (event.clientY - rect.top) / rect.height;
  material.uniforms.uCenter.value.set(x, y);
  showStatus('Distortion center moved.', 850);
}

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function setCaptureMode(mode) {
  if (isRecording()) return;
  captureMode = mode;
  const isPhoto = mode === 'photo';
  photoModeButton.classList.toggle('active', isPhoto);
  videoModeButton.classList.toggle('active', !isPhoto);
  shutterButton.classList.toggle('photo', isPhoto);
  shutterButton.classList.toggle('video', !isPhoto);
  shutterButton.setAttribute('aria-label', isPhoto ? 'Take photo' : 'Start video recording');
}

function flashCamera() {
  flash.classList.remove('active');
  void flash.offsetWidth;
  flash.classList.add('active');
}

async function takePhoto() {
  if (!ready || !renderer) {
    showStatus('Open the camera first.');
    return;
  }

  renderer.render(scene, renderCamera);
  flashCamera();

  const blob = await new Promise((resolve) => {
    renderer.domElement.toBlob(resolve, 'image/jpeg', 0.94);
  });

  if (!blob) {
    showStatus('Photo capture failed.');
    return;
  }

  const filename = `distortion-field-${timestamp()}.jpg`;
  setLastCapture({ blob, filename, type: 'photo', duration: 0 });
  showStatus('Photo captured.');
  openPreview();
}

function selectRecordingMimeType() {
  if (!window.MediaRecorder) return '';
  const candidates = [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function isRecording() {
  return mediaRecorder?.state === 'recording';
}

function startRecording() {
  if (!ready || !renderer) {
    showStatus('Open the camera first.');
    return;
  }
  if (!window.MediaRecorder || typeof canvas.captureStream !== 'function') {
    showStatus('Video recording is not supported in this browser.', 4500);
    return;
  }

  try {
    recordingChunks = [];
    recordingMimeType = selectRecordingMimeType();
    const canvasStream = canvas.captureStream(30);
    const options = {
      videoBitsPerSecond: 6_000_000
    };
    if (recordingMimeType) options.mimeType = recordingMimeType;

    mediaRecorder = new MediaRecorder(canvasStream, options);
    mediaRecorder.addEventListener('dataavailable', (event) => {
      if (event.data?.size) recordingChunks.push(event.data);
    });
    mediaRecorder.addEventListener('stop', finishRecording, { once: true });
    mediaRecorder.addEventListener('error', (event) => {
      console.error(event.error || event);
      showStatus('Video recording failed.', 4500);
      resetRecordingUi();
    }, { once: true });

    mediaRecorder.start(250);
    recordingStartedAt = Date.now();
    document.body.classList.add('is-recording');
    shutterButton.classList.add('recording');
    shutterButton.setAttribute('aria-label', 'Stop video recording');
    recordingBadge.hidden = false;
    recordingTime.textContent = '00:00';
    switchButton.disabled = true;

    clearInterval(recordingTimer);
    recordingTimer = setInterval(() => {
      const elapsed = Date.now() - recordingStartedAt;
      recordingTime.textContent = formatDuration(elapsed);
      if (elapsed >= MAX_RECORDING_MS) stopRecording();
    }, 200);
  } catch (error) {
    console.error(error);
    showStatus('This browser could not start video recording.', 4500);
    resetRecordingUi();
  }
}

function stopRecording() {
  if (!isRecording()) return;
  mediaRecorder.stop();
}

function finishRecording() {
  const duration = Date.now() - recordingStartedAt;
  const mimeType = mediaRecorder?.mimeType || recordingMimeType || 'video/webm';
  const blob = new Blob(recordingChunks, { type: mimeType });
  const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
  const filename = `distortion-field-${timestamp()}.${extension}`;

  resetRecordingUi();

  if (!blob.size) {
    showStatus('The recording was empty. Try again.', 4500);
    return;
  }

  setLastCapture({ blob, filename, type: 'video', duration });
  showStatus('Video recorded.');
  openPreview();
}

function resetRecordingUi() {
  clearInterval(recordingTimer);
  recordingTimer = null;
  document.body.classList.remove('is-recording');
  shutterButton.classList.remove('recording');
  shutterButton.setAttribute('aria-label', 'Start video recording');
  recordingBadge.hidden = true;
  switchButton.disabled = false;
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function setLastCapture(capture) {
  if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
  lastCapture = capture;
  lastObjectUrl = URL.createObjectURL(capture.blob);
  openLastButton.disabled = false;

  if (capture.type === 'photo') {
    lastThumb.textContent = '';
    lastThumb.style.backgroundImage = `url("${lastObjectUrl}")`;
  } else {
    lastThumb.textContent = 'VIDEO';
    lastThumb.style.backgroundImage = 'none';
  }
}

function openPreview() {
  if (!lastCapture) return;
  closePreviewMedia();
  previewObjectUrl = URL.createObjectURL(lastCapture.blob);
  previewFrame.replaceChildren();

  if (lastCapture.type === 'photo') {
    const image = new Image();
    image.alt = 'Captured distorted view';
    image.src = previewObjectUrl;
    previewFrame.appendChild(image);
    previewTitle.textContent = 'PHOTO CAPTURED';
    previewMeta.textContent = formatFileSize(lastCapture.blob.size);
  } else {
    const playback = document.createElement('video');
    playback.src = previewObjectUrl;
    playback.controls = true;
    playback.playsInline = true;
    playback.loop = true;
    playback.autoplay = true;
    playback.muted = true;
    previewFrame.appendChild(playback);
    previewTitle.textContent = 'VIDEO CAPTURED';
    previewMeta.textContent = `${formatDuration(lastCapture.duration)} / ${formatFileSize(lastCapture.blob.size)}`;
  }

  preview.hidden = false;
}

function closePreviewMedia() {
  previewFrame.querySelectorAll('video').forEach((item) => item.pause());
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = '';
}

function closePreview() {
  preview.hidden = true;
  closePreviewMedia();
  previewFrame.replaceChildren();
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function saveLastCapture() {
  if (!lastCapture) return;

  if (typeof window.showSaveFilePicker === 'function') {
    try {
      const mimeType = (lastCapture.blob.type || (lastCapture.type === 'photo' ? 'image/jpeg' : 'video/webm')).split(';')[0];
      const extension = lastCapture.filename.split('.').pop();
      const handle = await window.showSaveFilePicker({
        suggestedName: lastCapture.filename,
        types: [{
          description: lastCapture.type === 'photo' ? 'Image' : 'Video',
          accept: { [mimeType]: [`.${extension}`] }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(lastCapture.blob);
      await writable.close();
      showStatus('Saved.');
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
      console.warn('Native save picker failed, falling back to download.', error);
    }
  }

  downloadLastCapture();
  showStatus('Saved to your browser downloads.', 3200);
}

async function shareLastCapture() {
  if (!lastCapture) return;
  const file = new File([lastCapture.blob], lastCapture.filename, {
    type: lastCapture.blob.type || (lastCapture.type === 'photo' ? 'image/jpeg' : 'video/webm'),
    lastModified: Date.now()
  });

  const shareData = { files: [file] };
  if (navigator.share && navigator.canShare?.(shareData)) {
    try {
      await navigator.share({
        files: [file],
        title: 'Distortion Field',
        text: 'Created with Distortion Field by Yssem Lab.'
      });
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
      console.warn('Native sharing failed.', error);
    }
  }

  showStatus('File sharing is not supported in this browser.', 3800);
}

function downloadLastCapture() {
  if (!lastCapture) return;
  const url = URL.createObjectURL(lastCapture.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = lastCapture.filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function handleShutter() {
  if (captureMode === 'photo') {
    takePhoto();
  } else if (isRecording()) {
    stopRecording();
  } else {
    startRecording();
  }
}

startButton.addEventListener('click', startCamera);
toggleControlsButton.addEventListener('click', () => {
  const collapsed = controls.classList.toggle('collapsed');
  toggleControlsButton.setAttribute('aria-expanded', String(!collapsed));
});
switchButton.addEventListener('click', async () => {
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  await startCamera();
});
video.addEventListener('loadedmetadata', updateVideoSize);
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 180));
window.addEventListener('pointerdown', setCenterFromPointer);
window.addEventListener('pagehide', () => {
  if (isRecording()) stopRecording();
  stream?.getTracks().forEach((track) => track.stop());
  if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
  closePreviewMedia();
});

modeButtons.forEach((button) => {
  button.addEventListener('click', () => setMode(Number(button.dataset.mode)));
});
[strengthInput, radiusInput, frequencyInput].forEach((input) => {
  input.addEventListener('input', updateUniforms);
});
randomButton.addEventListener('click', randomize);
resetButton.addEventListener('click', reset);
photoModeButton.addEventListener('click', () => setCaptureMode('photo'));
videoModeButton.addEventListener('click', () => setCaptureMode('video'));
shutterButton.addEventListener('click', handleShutter);
openLastButton.addEventListener('click', openPreview);
closePreviewButton.addEventListener('click', closePreview);
savePreviewButton.addEventListener('click', saveLastCapture);
sharePreviewButton.addEventListener('click', shareLastCapture);

['pointerdown', 'touchstart'].forEach((type) => {
  beforeButton.addEventListener(type, () => setBefore(true), { passive: true });
});
['pointerup', 'pointercancel', 'pointerleave', 'touchend', 'touchcancel'].forEach((type) => {
  beforeButton.addEventListener(type, () => setBefore(false), { passive: true });
});

setOutputs();
setCaptureMode('photo');
