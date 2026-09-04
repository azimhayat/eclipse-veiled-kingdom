# Android test package

The Android project wraps the existing V5 web game with Capacitor. It does not replace or modify the GitHub Pages release.

## Identity

- App name: `Eclipse of the Veiled Kingdom`
- Provisional Android application ID: `com.azimhayat.eclipseveiledkingdom`
- Minimum Android version: Android 7.0 (API 24)
- Target Android version: API 36

The application ID is suitable for the test build. Confirm publisher ownership before using it for a permanent store release because a published application ID cannot be reused by another app.

## Build

Run `npm run android:sync` after web changes. A Windows machine with Java 21 and the Android SDK can then run `npm run android:apk` to produce `android/app/build/outputs/apk/debug/app-debug.apk`.

The `Build V5 Android test APK` GitHub Actions workflow performs the same build and publishes a temporary downloadable artifact. It does not deploy the website or publish the APK to an app store.

## Package policy

The Android build uses relative asset URLs so the game, artwork, music, sound effects, and current V2 cinematics are bundled for offline play. Superseded V1 cinematic exports are removed only from the generated Android package, reducing its size without touching source media or the web release. The Global Top 10 requires an internet connection; gameplay and local saves do not.

The test app is fullscreen and automatically rotates between the two landscape orientations. It requests only internet access, needed for the optional Global Top 10 service.

## Release signing

The automated artifact is a debug-signed test APK. Before public distribution, create a protected publisher-owned signing key, produce a signed release APK and Android App Bundle, store the key outside Git, and test upgrade/install behavior using the same key.
