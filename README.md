# DISTORTION FIELD — Prototype 02.5

A responsive reality-filter camera by Yssem Lab. It transforms a live camera feed with Bend, Bulge, Twist and Wave shaders, then captures the distorted result as a photo or video.

The original **UNBUILDABLE — Prototype 01** remains a separate project. This folder is the updated **DISTORTION FIELD** version.

## Version 2.5 updates

- **SOUND CONTROL** now drives two visual parameters at the same time:
  - estimated `15–50 dB` → `STRENGTH 0–1`
  - detected dominant `50–250 Hz` → `FREQUENCY 0–1`
- While sound control is active, both the strength and frequency sliders become read-only and visibly follow the microphone.
- The frequency value displays the detected microphone frequency in `Hz`.
- When no stable pitch is detected, the display temporarily shows `-- Hz` and holds the most recent visual frequency setting.
- Turning sound control off restores manual normalized `0–1` control for both sliders.
- Internally, the normalized frequency value is mapped to the existing shader range, preserving the Bend/Wave visual behavior.

**Important:** The Hz reading is a real-time estimate of the strongest low-frequency tonal component, not a laboratory pitch meter. Speech, music and sustained tones work better than wind, claps or broadband noise. Microphone processing varies across phones.

## Existing features

- Rear camera by default
- Bend, Bulge, Twist and Wave distortion modes
- Tap the image to move the distortion center
- Strength, radius and normalized frequency controls
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
