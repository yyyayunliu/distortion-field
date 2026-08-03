# DISTORTION FIELD — Prototype 02.4

A responsive reality-filter camera by Yssem Lab. It transforms a live camera feed with Bend, Bulge, Twist and Wave shaders, then captures the distorted result as a photo or video.

The original **UNBUILDABLE — Prototype 01** remains a separate project. This folder is the updated **DISTORTION FIELD** version.

## Version 2.4 updates

- Replaced **RESET** with a **SOUND CONTROL** toggle in the utility row.
- When enabled, microphone level drives `STRENGTH` in real time.
- The displayed range maps linearly as requested:
  - estimated `15 dB` → strength `0`
  - estimated `50 dB` → strength `1`
- The strength slider becomes read-only while sound control is active and visibly follows the microphone.
- Sound control is enabled by default after entering the camera.
- The separate dB meter has been removed; while sound control is on, the `STRENGTH` value displays the live estimated dB reading.
- The existing video recorder reuses the same microphone stream, so sound-controlled visual changes and microphone audio can be recorded together.
- Turning sound control off returns strength to manual slider control.
- Refined the control-panel layout: the live dB value stays on one line, all slider labels and values are left-aligned, slider tracks are shorter, and the panel container is fully transparent.

**Important:** Web browsers expose digital microphone amplitude (dBFS), not calibrated real-world sound pressure level. The prototype applies a practical offset to show an estimated 15–50 dB range. Accurate SPL measurement would require per-device calibration or a native app.

## Existing features

- Rear camera by default
- Bend, Bulge, Twist and Wave distortion modes
- Tap the image to move the distortion center
- Strength, radius and frequency controls
- Sliders and effect modes remain interactive during recording
- Random, sound-control and hold-before controls
- Front/rear camera switching
- High-quality JPEG photo capture
- Video recording of the distorted canvas, up to 30 seconds
- Combined **SAVE/SHARE** flow
- Captured-media preview
- Portrait and landscape cover scaling

## Camera and microphone permissions

Camera access is requested when the user presses **ENTER**. Because **SOUND CONTROL** is on by default, microphone access is requested immediately after the camera opens. If sound control is switched off, video recording can request the microphone again when needed.

For more responsive level control, the prototype requests the microphone without echo cancellation, noise suppression or automatic gain control when the browser allows it. Browsers may ignore these preferences. Support and output formats still vary, so iPhone Safari and Android Chrome should be tested separately.

## Save and share behavior

**SAVE/SHARE** opens the device's native share sheet when file sharing is supported. On phones, that sheet can offer saving to Photos or Files as well as sharing to contacts and social apps. If native file sharing is unavailable, the prototype falls back to the browser's file-save or download flow.

A normal mobile website cannot guarantee direct, silent insertion into every device's Photos library. A future Capacitor/native app can provide direct photo-library access.

## Run locally

Camera and microphone access require HTTPS or localhost.

```bash
python -m http.server 8000
```

Open `http://localhost:8000` on the same computer. For phone testing, deploy to GitHub Pages because plain local-network HTTP may not be allowed to access the camera or microphone.

## Deploy to GitHub Pages

1. Upload all files in this folder to the repository root.
2. Open **Settings → Pages**.
3. Select **Deploy from a branch**.
4. Select `main` and `/root`.
5. Open the generated HTTPS Pages URL on the phone.

## Notes

This prototype applies screen-space distortion to the complete camera image. It does not yet detect walls, buildings or people, and the distortion is not anchored to real-world geometry.
