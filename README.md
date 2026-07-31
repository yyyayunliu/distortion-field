# DISTORTION FIELD — Prototype 02

A mobile-first reality filter by Yssem Lab. It turns a live phone-camera feed into bendable, bulging, twisting and waving architecture, then lets the user photograph or record the distorted result.

The original **UNBUILDABLE — Prototype 01** is preserved separately. This folder is the renamed and expanded V2.

## Features

- Rear camera by default
- Bend, Bulge, Twist and Wave distortion modes
- Tap the image to move the distortion center
- Strength, radius and frequency controls
- Random, reset and hold-before controls
- Front/rear camera switching
- Photo capture as high-quality JPEG
- Video recording of the distorted WebGL canvas, up to 30 seconds
- Recording timer and stop control
- Captured-media preview
- Native mobile **Save / Share** flow when file sharing is supported
- Download fallback for other browsers
- Portrait and landscape cover scaling

## Saving to a phone

A mobile website cannot silently write into the Photos library. The app therefore creates an image or video file and then:

1. Opens the phone's native share sheet when file sharing is available.
2. The user chooses **Save Image** or **Save Video** when that option is offered.
3. If native file sharing is unavailable, the file downloads instead and can be opened or moved to Photos manually.

The exact share-sheet options depend on the browser and operating system.

## Video compatibility

The app records the WebGL canvas with `canvas.captureStream()` and `MediaRecorder`. It tests the browser's supported formats and prefers MP4/H.264, then falls back to WebM. Video recording is feature-detected and a clear message is shown when unsupported.

## Run locally

Camera access requires HTTPS or localhost.

### Python

```bash
python -m http.server 8000
```

Open `http://localhost:8000` on the same computer.

For phone testing, deploy to GitHub Pages or use an HTTPS local-tunneling tool. A plain local-network HTTP address may not be allowed to access the camera.

## Deploy to GitHub Pages

1. Create a new GitHub repository.
2. Upload all files in this folder to the repository root.
3. Open **Settings → Pages**.
4. Select **Deploy from a branch**.
5. Select `main` and `/root`.
6. Open the generated HTTPS Pages URL on the phone.

## Notes

This prototype applies screen-space distortion to the complete camera image. It does not yet detect walls, buildings or people, and the distortion is not anchored to real-world geometry.
