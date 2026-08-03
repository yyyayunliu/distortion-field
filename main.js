import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js';

const video = document.querySelector('#camera');
const canvas = document.querySelector('#stage');
const vortexCanvas = document.querySelector('#vortexCanvas');
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
const strengthControl = document.querySelector('#strengthControl');
const soundControlButton = document.querySelector('#soundControl');
const soundControlState = document.querySelector('#soundControlState');
const soundDbValue = document.querySelector('#soundDbValue');
const soundMeterFill = document.querySelector('#soundMeterFill');
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
const saveSharePreviewButton = document.querySelector('#saveSharePreview');

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
let microphoneStream = null;
let recordingStream = null;
let recordingAudioTrack = null;
let recordingHasAudio = false;
let recordingStarting = false;
let audioContext = null;
let vortexRenderer = null;
let vortexMaterial = null;
let vortexRunning = true;
let soundControlEnabled = false;
let soundAnalyser = null;
let soundSourceNode = null;
let soundLevelData = null;
let smoothedSoundStrength = 0;

const defaults = {
  mode: 0,
  strength: 0.24,
  radius: 0.42,
  frequency: 4.0,
  center: [0.5, 0.5]
};

const MAX_RECORDING_MS = 30_000;
const MIC_MIN_DB = 30;
const MIC_MAX_DB = 55;
const MIC_DB_OFFSET = 90;
const SOUND_SMOOTHING = 0.76;


function initVortex() {
  if (!vortexCanvas) return;

  try {
    vortexRenderer = new THREE.WebGLRenderer({
      canvas: vortexCanvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance'
    });
    vortexRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

    const vortexScene = new THREE.Scene();
    const vortexCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    vortexMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) }
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
        uniform float uTime;
        uniform vec2 uResolution;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        void main() {
          vec2 p = vUv - 0.5;
          p.x *= uResolution.x / max(uResolution.y, 1.0);

          float radius = length(p);
          float angle = atan(p.y, p.x);
          float breathing = sin(uTime * 0.55) * 0.12;
          float spiralAngle = angle * 7.0 + log(radius + 0.035) * (12.5 + breathing) - uTime * 0.82;
          float secondary = sin(angle * 3.0 - radius * 19.0 + uTime * 0.34) * 0.42;
          float bands = 0.5 + 0.5 * sin(spiralAngle + secondary);
          bands = smoothstep(0.29, 0.71, bands);

          float funnel = smoothstep(0.015, 0.12, radius);
          float edgeFade = 1.0 - smoothstep(0.48, 1.05, radius);
          float centerGlow = exp(-radius * 19.0) * 0.44;
          float grain = (hash(gl_FragCoord.xy + floor(uTime * 12.0)) - 0.5) * 0.035;
          float shade = mix(0.018, 0.84, bands) * funnel * edgeFade + centerGlow + grain;

          gl_FragColor = vec4(vec3(clamp(shade, 0.0, 1.0)), 1.0);
        }
      `
    });

    vortexScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), vortexMaterial));

    const resizeVortex = () => {
      if (!vortexRenderer || !vortexMaterial) return;
      const width = Math.max(1, window.innerWidth);
      const height = Math.max(1, window.innerHeight);
      vortexRenderer.setSize(width, height, false);
      vortexMaterial.uniforms.uResolution.value.set(width, height);
    };

    const animateVortex = (time = 0) => {
      requestAnimationFrame(animateVortex);
      if (!vortexRunning || !vortexRenderer || !vortexMaterial) return;
      vortexMaterial.uniforms.uTime.value = time * 0.001;
      vortexRenderer.render(vortexScene, vortexCamera);
    };

    resizeVortex();
    window.addEventListener('resize', resizeVortex);
    animateVortex();
  } catch (error) {
    console.warn('Animated vortex could not be initialized.', error);
  }
}

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) audioContext = new AudioContextClass();
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  return audioContext;
}

function playTone(context, startTime, duration, startFrequency, endFrequency, gainValue, wave = 'sine') {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(startFrequency, startTime);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), startTime + duration);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(gainValue, startTime + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.02);
}

function playNoise(context, startTime, duration, gainValue) {
  const frameCount = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < frameCount; index += 1) {
    data[index] = (Math.random() * 2 - 1) * Math.exp(-index / Math.max(1, frameCount * 0.18));
  }
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer;
  filter.type = 'bandpass';
  filter.frequency.value = 1900;
  filter.Q.value = 0.75;
  gain.gain.setValueAtTime(gainValue, startTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  source.connect(filter).connect(gain).connect(context.destination);
  source.start(startTime);
}

function playUiSound(type) {
  const context = getAudioContext();
  if (!context) return;
  const now = context.currentTime + 0.012;

  // Synthesized camera cues: familiar in character, but not copied from Apple's samples.
  if (type === 'photo') {
    playNoise(context, now, 0.055, 0.19);
    playTone(context, now, 0.07, 190, 82, 0.11, 'triangle');
    playTone(context, now + 0.027, 0.045, 940, 520, 0.045, 'square');
  } else if (type === 'record-start') {
    playTone(context, now, 0.085, 620, 880, 0.075, 'sine');
    playTone(context, now + 0.09, 0.075, 880, 1180, 0.065, 'sine');
  } else if (type === 'record-stop') {
    playTone(context, now, 0.09, 980, 660, 0.075, 'sine');
    playTone(context, now + 0.095, 0.075, 660, 430, 0.06, 'sine');
  }
}

async function ensureMicrophone(purpose = 'recording') {
  const activeTrack = microphoneStream?.getAudioTracks().find((track) => track.readyState === 'live');
  if (activeTrack) return activeTrack;

  try {
    microphoneStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      },
      video: false
    });
    return microphoneStream.getAudioTracks()[0] || null;
  } catch (error) {
    console.warn('Microphone access was unavailable.', error);
    showStatus(
      purpose === 'sound-control'
        ? 'Microphone unavailable. Sound control stays off.'
        : 'Microphone unavailable. Recording video without sound.',
      4200
    );
    return null;
  }
}

function disconnectSoundAnalyser() {
  try {
    soundSourceNode?.disconnect();
  } catch (error) {
    console.debug('Sound analyser was already disconnected.', error);
  }
  soundSourceNode = null;
  soundAnalyser = null;
  soundLevelData = null;
}

function setSoundControlUi(enabled) {
  soundControlEnabled = enabled;
  soundControlButton.classList.toggle('active', enabled);
  soundControlButton.setAttribute('aria-pressed', String(enabled));
  soundControlState.textContent = enabled ? 'ON' : 'OFF';
  controls.classList.toggle('sound-control-active', enabled);
  strengthInput.disabled = enabled;

  if (!enabled) {
    soundDbValue.value = '--';
    soundMeterFill.style.transform = 'scaleX(0)';
  }
}

async function enableSoundControl() {
  if (!ready) {
    showStatus('Open the camera first.');
    return false;
  }

  soundControlButton.disabled = true;
  try {
    const microphoneTrack = await ensureMicrophone('sound-control');
    const context = getAudioContext();
    if (!microphoneTrack || !context || !microphoneStream) return false;

    disconnectSoundAnalyser();
    soundAnalyser = context.createAnalyser();
    soundAnalyser.fftSize = 1024;
    soundAnalyser.smoothingTimeConstant = 0.55;
    soundSourceNode = context.createMediaStreamSource(microphoneStream);
    soundSourceNode.connect(soundAnalyser);
    soundLevelData = new Float32Array(soundAnalyser.fftSize);
    smoothedSoundStrength = Number(strengthInput.value);
    setSoundControlUi(true);
    showStatus('Sound control on: 30–55 dB controls strength 0–1.', 3200);
    return true;
  } catch (error) {
    console.error('Sound control could not start.', error);
    showStatus('Sound control could not access the microphone.', 4200);
    return false;
  } finally {
    soundControlButton.disabled = false;
  }
}

function disableSoundControl() {
  setSoundControlUi(false);
  disconnectSoundAnalyser();

  if (!isRecording()) {
    microphoneStream?.getTracks().forEach((track) => track.stop());
    microphoneStream = null;
  }

  showStatus('Sound control off. Strength is manual.');
}

async function toggleSoundControl() {
  if (soundControlEnabled) disableSoundControl();
  else await enableSoundControl();
}

function updateSoundControl() {
  if (!soundControlEnabled || !soundAnalyser || !soundLevelData || !material) return;

  soundAnalyser.getFloatTimeDomainData(soundLevelData);
  let sumSquares = 0;
  for (let index = 0; index < soundLevelData.length; index += 1) {
    sumSquares += soundLevelData[index] * soundLevelData[index];
  }

  const rms = Math.sqrt(sumSquares / soundLevelData.length);
  const dbFs = 20 * Math.log10(Math.max(rms, 0.0000001));
  const estimatedDb = THREE.MathUtils.clamp(dbFs + MIC_DB_OFFSET, MIC_MIN_DB, MIC_MAX_DB);
  const targetStrength = (estimatedDb - MIC_MIN_DB) / (MIC_MAX_DB - MIC_MIN_DB);
  smoothedSoundStrength = smoothedSoundStrength * SOUND_SMOOTHING + targetStrength * (1 - SOUND_SMOOTHING);
  const strength = THREE.MathUtils.clamp(smoothedSoundStrength, 0, 1);

  strengthInput.value = strength.toFixed(2);
  strengthValue.value = strength.toFixed(2);
  material.uniforms.uStrength.value = strength;
  soundDbValue.value = String(Math.round(estimatedDb));
  soundMeterFill.style.transform = `scaleX(${targetStrength.toFixed(3)})`;
}

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
    getAudioContext();
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
    vortexRunning = false;

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
  updateSoundControl();
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
  if (!soundControlEnabled) strengthInput.value = defaults.strength;
  radiusInput.value = defaults.radius;
  frequencyInput.value = defaults.frequency;
  setMode(defaults.mode);
  if (material) material.uniforms.uCenter.value.set(...defaults.center);
  updateUniforms();
}

function randomize() {
  const mode = Math.floor(Math.random() * 4);
  if (!soundControlEnabled) strengthInput.value = (0.15 + Math.random() * 0.65).toFixed(2);
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
  if (isRecording() || recordingStarting) return;
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
  playUiSound('photo');
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

function selectRecordingMimeType(hasAudio) {
  if (!window.MediaRecorder) return '';
  const candidates = hasAudio
    ? [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm'
      ]
    : [
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

async function startRecording() {
  if (!ready || !renderer) {
    showStatus('Open the camera first.');
    return;
  }
  if (recordingStarting || isRecording()) return;
  if (!window.MediaRecorder || typeof canvas.captureStream !== 'function') {
    showStatus('Video recording is not supported in this browser.', 4500);
    return;
  }

  recordingStarting = true;
  shutterButton.disabled = true;

  try {
    const microphoneTrack = await ensureMicrophone();
    recordingHasAudio = Boolean(microphoneTrack);
    recordingChunks = [];

    const canvasStream = canvas.captureStream(30);
    recordingStream = new MediaStream(canvasStream.getVideoTracks());

    if (microphoneTrack) {
      recordingAudioTrack = microphoneTrack.clone();
      recordingStream.addTrack(recordingAudioTrack);
    }

    recordingMimeType = selectRecordingMimeType(recordingHasAudio);
    const options = {
      videoBitsPerSecond: 6_000_000
    };
    if (recordingHasAudio) options.audioBitsPerSecond = 128_000;
    if (recordingMimeType) options.mimeType = recordingMimeType;

    mediaRecorder = new MediaRecorder(recordingStream, options);
    mediaRecorder.addEventListener('dataavailable', (event) => {
      if (event.data?.size) recordingChunks.push(event.data);
    });
    mediaRecorder.addEventListener('stop', finishRecording, { once: true });
    mediaRecorder.addEventListener('error', (event) => {
      console.error(event.error || event);
      showStatus('Video recording failed.', 4500);
      resetRecordingUi();
    }, { once: true });

    playUiSound('record-start');
    await new Promise((resolve) => setTimeout(resolve, 190));
    mediaRecorder.start(250);
    recordingStartedAt = Date.now();
    document.body.classList.add('is-recording');
    shutterButton.classList.add('recording');
    shutterButton.setAttribute('aria-label', 'Stop video recording');
    recordingBadge.hidden = false;
    recordingTime.textContent = '00:00';
    switchButton.disabled = true;
    showStatus(recordingHasAudio ? 'Recording with microphone audio.' : 'Recording without microphone audio.', 1800);

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
  } finally {
    recordingStarting = false;
    shutterButton.disabled = false;
  }
}

function stopRecording() {
  if (!isRecording()) return;
  mediaRecorder.stop();
  playUiSound('record-stop');
}

function finishRecording() {
  const duration = Date.now() - recordingStartedAt;
  const mimeType = mediaRecorder?.mimeType || recordingMimeType || 'video/webm';
  const blob = new Blob(recordingChunks, { type: mimeType });
  const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
  const filename = `distortion-field-${timestamp()}.${extension}`;
  const hasAudio = recordingHasAudio;

  resetRecordingUi();

  if (!blob.size) {
    showStatus('The recording was empty. Try again.', 4500);
    return;
  }

  setLastCapture({ blob, filename, type: 'video', duration, hasAudio });
  showStatus(hasAudio ? 'Video recorded with sound.' : 'Video recorded without sound.');
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
  recordingAudioTrack?.stop();
  recordingAudioTrack = null;
  recordingStream?.getVideoTracks().forEach((track) => track.stop());
  recordingStream = null;
  recordingHasAudio = false;

  if (!soundControlEnabled) {
    microphoneStream?.getTracks().forEach((track) => track.stop());
    microphoneStream = null;
    disconnectSoundAnalyser();
  }
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
    playback.autoplay = false;
    playback.muted = false;
    previewFrame.appendChild(playback);
    previewTitle.textContent = 'VIDEO CAPTURED';
    const audioLabel = lastCapture.hasAudio ? 'WITH AUDIO' : 'NO AUDIO';
    previewMeta.textContent = `${formatDuration(lastCapture.duration)} / ${audioLabel} / ${formatFileSize(lastCapture.blob.size)}`;
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

async function saveOrShareLastCapture() {
  if (!lastCapture) return;

  const file = new File([lastCapture.blob], lastCapture.filename, {
    type: lastCapture.blob.type || (lastCapture.type === 'photo' ? 'image/jpeg' : 'video/webm'),
    lastModified: Date.now()
  });
  const shareData = { files: [file] };

  // On supported phones this opens the system share sheet, where the user can
  // save to Photos/Files or share to contacts and social apps.
  if (navigator.share && navigator.canShare?.(shareData)) {
    try {
      await navigator.share({
        files: [file],
        title: 'Distortion Field'
      });
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
      console.warn('Native save/share failed; falling back to file save.', error);
    }
  }

  await saveLastCapture();
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
  microphoneStream?.getTracks().forEach((track) => track.stop());
  disconnectSoundAnalyser();
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
soundControlButton.addEventListener('click', toggleSoundControl);
photoModeButton.addEventListener('click', () => setCaptureMode('photo'));
videoModeButton.addEventListener('click', () => setCaptureMode('video'));
shutterButton.addEventListener('click', handleShutter);
openLastButton.addEventListener('click', openPreview);
closePreviewButton.addEventListener('click', closePreview);
saveSharePreviewButton.addEventListener('click', saveOrShareLastCapture);

['pointerdown', 'touchstart'].forEach((type) => {
  beforeButton.addEventListener(type, () => setBefore(true), { passive: true });
});
['pointerup', 'pointercancel', 'pointerleave', 'touchend', 'touchcancel'].forEach((type) => {
  beforeButton.addEventListener(type, () => setBefore(false), { passive: true });
});

initVortex();
setOutputs();
setSoundControlUi(false);
setCaptureMode('photo');
