# DISTORTION FIELD — Prototype 02.3

A responsive reality-filter camera by Yssem Lab. It transforms a live camera feed with Bend, Bulge, Twist and Wave shaders, then captures the distorted result as a photo or video.

The original **UNBUILDABLE — Prototype 01** remains a separate project. This folder is the updated **DISTORTION FIELD** version.

## Version 2.3 updates

- Synthesized camera feedback sounds:
  - shutter cue for photos
  - start cue for video recording
  - stop cue for video recording
- The cues are original Web Audio synthesis inspired by familiar phone-camera behavior; they do not copy Apple audio samples.
- Video recording now requests microphone access and combines the microphone track with the distorted WebGL canvas.
- If microphone permission is denied or unavailable, recording continues without audio.
- The video preview reports `WITH AUDIO` or `NO AUDIO` and plays with sound when the user presses play.
- Desktop layouts place the expanded distortion controls in a narrow panel on the far left.
- Mobile layouts retain the collapsible bottom control panel.
- The launch screen now uses a real animated WebGL spiral vortex based on polar twist distortion, on both desktop and mobile.

## Existing features

- Rear camera by default
- Bend, Bulge, Twist and Wave distortion modes
- Tap the image to move the distortion center
- Strength, radius and frequency controls
- Sliders and effect modes remain interactive during recording
- Random, reset and hold-before controls
- Front/rear camera switching
- High-quality JPEG photo capture
- Video recording of the distorted canvas, up to 30 seconds
- Combined **SAVE/SHARE** flow
- Captured-media preview
- Portrait and landscape cover scaling

## Camera and microphone permissions

Camera access is requested when the user presses **ENTER**. Microphone access is requested only when the user starts the first video recording.

The microphone uses browser-provided echo cancellation, noise suppression and automatic gain control when available. Support and output formats still vary by browser, so iPhone Safari and Android Chrome should be tested separately.

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
