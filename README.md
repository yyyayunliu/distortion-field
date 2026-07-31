# DISTORTION FIELD — Prototype 02.1

A mobile-first reality filter by Yssem Lab. It turns a live phone-camera feed into bendable, bulging, twisting and waving architecture, then lets the user photograph or record the distorted result.

The original **UNBUILDABLE — Prototype 01** remains a separate project. This folder is the updated **DISTORTION FIELD** version.

## Interface updates

- Minimal launch screen with animated vortex
- `DISTORTION FIELD` title, `BY YSSEM LAB` credit and `ENTER` button
- Collapsible distortion controls, leaving the camera view clear after setup
- Camera switch control beside the shutter, using a two-arrow icon
- Recording timer beside the bottom camera controls; hidden in photo mode
- Separate **SAVE** and **SHARE** actions after capture
- Removed the previous download button and instructional note

## Features

- Rear camera by default
- Bend, Bulge, Twist and Wave distortion modes
- Tap the image to move the distortion center
- Strength, radius and frequency controls
- Random, reset and hold-before controls
- Front/rear camera switching
- Photo capture as high-quality JPEG
- Video recording of the distorted WebGL canvas, up to 30 seconds
- Captured-media preview
- Portrait and landscape cover scaling

## Save and share behavior

**SAVE** uses the browser's native save-file picker where supported. Otherwise it saves the generated file through the browser's download system.

**SHARE** opens the device's native share interface when file sharing is supported, allowing the result to be sent to contacts or social apps.

A normal mobile website cannot guarantee direct, silent insertion into every device's Photos library. Browser and operating-system behavior differs, especially on iPhone. A future native iOS/Android wrapper could provide direct photo-library access.

## Run locally

Camera access requires HTTPS or localhost.

```bash
python -m http.server 8000
```

Open `http://localhost:8000` on the same computer. For phone testing, deploy to GitHub Pages because a plain local-network HTTP address may not be allowed to access the camera.

## Deploy to GitHub Pages

1. Upload all files in this folder to the repository root.
2. Open **Settings → Pages**.
3. Select **Deploy from a branch**.
4. Select `main` and `/root`.
5. Open the generated HTTPS Pages URL on the phone.

## Notes

This prototype applies screen-space distortion to the complete camera image. It does not yet detect walls, buildings or people, and the distortion is not anchored to real-world geometry.
