# AfriResQ Android app

Flutter client for the AfriResQ API. Open this in **Android Studio**.

## Open in Android Studio

1. Install the **Flutter** and **Dart** plugins (Android Studio → Settings → Plugins).
2. **File → Open** and choose:

```
/home/ssebabe/Desktop/AfriResQ/mobile
```

3. Wait for Gradle sync.
4. Pick an emulator or a USB device, then press **Run**.

You can also open only `mobile/android` as a Gradle project, but opening `mobile` (the Flutter project) is the intended path.

## API URL

The app talks to the Node backend.

| Where the app runs | API URL to enter on the home screen |
|---|---|
| Android emulator | `http://10.0.2.2:4001` (already the default) |
| Physical phone on Wi‑Fi | `http://YOUR_COMPUTER_LAN_IP:4001` |

Start the backend first:

```bash
cd backend && npm start
```

Then tap **Save API URL** on the landing screen if you are not using the emulator default.

## Demo logins

| Role | Phone | Password |
|------|-------|----------|
| Citizen | +256700000099 | CitizenPass123! |
| Responder | +256700000010 | ResponderPass123! |
| Coordinator | +256700000002 | CoordPass123! |

## From the terminal

```bash
export ANDROID_HOME=$HOME/Android/Sdk
cd mobile
flutter pub get
flutter run
```
