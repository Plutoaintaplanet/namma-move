# Releasing Namma Move (Android APK) 🚀

Follow these steps to generate a shareable APK for the Namma Move Android application.

## Prerequisites
1. Ensure your backend is running and the URL is correctly set in `app/(tabs)/index.tsx` (or your config file).
2. The new logo is already integrated into `./assets/images/`.

---

## Method 1: EAS Build (Cloud - Recommended)

This is the easiest way to get an installable APK without setting up a full Android development environment.

1. **Install EAS CLI** (if not already installed):
   ```bash
   npm install -g eas-cli
   ```
2. **Login to Expo**:
   ```bash
   eas login
   ```
3. **Configure the project** (if first time):
   ```bash
   eas build:configure
   ```
4. **Build the APK**:
   Run this command to generate an APK that can be installed on any Android device:
   ```bash
   eas build -p android --profile preview
   ```
   *Follow the terminal prompts. Once finished, Expo will provide a download link for the `.apk` file.*

---

## Method 2: Local Gradle Build (Requires Android Studio)

If you have Android Studio and the Android SDK installed locally, you can build it yourself.

1. **Navigate to the Android folder**:
   ```bash
   cd namma-move-android/android
   ```
2. **Clean and Build**:
   ```powershell
   ./gradlew clean
   ./gradlew assembleRelease
   ```
3. **Find your APK**:
   The generated file will be located at:
   `namma-move-android/android/app/build/outputs/apk/release/app-release.apk`

---

## Distribution Tips
- **Testing**: Always test the generated APK on a physical device before sharing it.
- **Size**: The APK might be large (~30-50MB) as it includes the Expo runtime.
- **Sharing**: You can upload the APK to Google Drive, Dropbox, or Telegram to share it with friends for testing!

Happy Moving! 🚌🚇🛺
