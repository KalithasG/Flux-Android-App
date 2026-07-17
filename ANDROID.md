# Flux — Android App (Capacitor)

The Android app wraps the **same built web bundle** (`dist/`) in a native WebView via
Capacitor 8, so it looks and behaves exactly like the web app. All native behavior is
gated behind `Capacitor.isNativePlatform()` — the browser build is unchanged.

## Prerequisites (Windows)

- Android Studio (SDK 36, platform-tools, emulator). AGP 8.13 needs JDK ≥ 17 —
  the SDK path is wired via `android/local.properties` (gitignored).
- `JAVA_HOME` → Android Studio's JBR (`C:\Program Files\Android\Android Studio\jbr`).
- **All secrets/config live in `.env`** (gitignored; see `.env.example` for the contract):
  - `GEMINI_API_KEY` — inlined at build time via `vite.config.ts` define.
  - `VITE_FIREBASE_*` — Firebase web config consumed by `src/firebase.ts` via
    `import.meta.env`. Leave `VITE_FIREBASE_DATABASE_ID` unset to use the
    `(default)` Firestore database (required for the Firebase free tier).
  - `android/app/google-services.json` (also gitignored) — native Firebase config.
  Caveat: `.env` keeps these values out of *source control*, but they are still
  embedded in the built client bundle/APK — inherent to client-side Firebase and
  Gemini usage. Real protection = Firestore rules + API-key restrictions; moving
  Gemini behind a server proxy is future work.

> **Avast note (this machine):** Avast intercepts TLS for Java processes. Gradle is
> configured to use `%USERPROFILE%\.gradle\flux-cacerts` (JBR cacerts + Avast root CA)
> via `%USERPROFILE%\.gradle\gradle.properties`. Without it, Gradle fails with
> `PKIX path building failed`.

## Debug build & install

```powershell
npm run cap:sync            # vite build + capacitor sync into android/
cd android
.\gradlew.bat assembleDebug
adb install -r app\build\outputs\apk\debug\app-debug.apk
```

Debug builds trust user-added CAs (see `android/app/src/main/res/xml/network_security_config.xml`
`<debug-overrides>`) so they work behind TLS-inspecting antivirus/proxies. Release builds
trust system CAs only.

## Release build (sideload)

1. One-time: create a keystore **outside the repo**:
   ```powershell
   keytool -genkeypair -v -keystore $env:USERPROFILE\keystores\flux-release.keystore `
     -alias flux -keyalg RSA -keysize 2048 -validity 10000
   ```
2. One-time: add credentials to `%USERPROFILE%\.gradle\gradle.properties`:
   ```properties
   FLUX_STORE_FILE=C:\\Users\\<you>\\keystores\\flux-release.keystore
   FLUX_STORE_PASSWORD=...
   FLUX_KEY_ALIAS=flux
   FLUX_KEY_PASSWORD=...
   ```
3. Build: `.\gradlew.bat assembleRelease` → `android/app/build/outputs/apk/release/app-release.apk`.
   (Play Store later: `.\gradlew.bat bundleRelease` for an `.aab`.)
4. Bump `versionCode`/`versionName` in `android/app/build.gradle` per release.

## Google Sign-In on Android (wired ✅)

Implemented via `@capacitor-firebase/authentication`: native Google account picker →
`GoogleAuthProvider.credential(idToken)` → `signInWithCredential` into the JS SDK
(`src/components/AuthScreen.tsx`), so `onAuthStateChanged`/store.ts behave exactly as
on web. Native session is also cleared on logout (`App.tsx` SettingsModal).

Firebase project: **flux-v1-6a563** (Android app registered with the debug SHA-1;
`android/app/google-services.json` present, gitignored). When the **release**
keystore is created, add its SHA-1 in Firebase Console and re-download the JSON —
release-build Google sign-in fails without it.

Devices without any Google account get a friendly "add a Google account" error
(Credential Manager `NoCredentialException`).

## Branding assets

`assets/logo.svg` is the source of truth (derived from `src/components/FluxLogo.tsx`).
Launcher icons and splash screens are generated from `assets/icon*.png` / `assets/splash*.png`:

```powershell
npx @capacitor/assets generate --android --iconBackgroundColor '#FFFFFF' --splashBackgroundColor '#FFFFFF'
```

`@capacitor/assets` is intentionally **not** a devDependency (its bundled `tar` has
unfixable audit findings); the generated icons are committed, and `npx` fetches the
tool on demand if they ever need regenerating.

## Emulator testing on this machine

The emulator's virtual Wi-Fi/ethernet fails to get a default route on this host
(Avast interferes with the emulator's network stack). Workaround used for testing:

```powershell
node <scratchpad>\proxy.mjs                 # tiny HTTP CONNECT proxy on 127.0.0.1:8118
adb reverse tcp:8118 tcp:8118               # tunnel guest:8118 -> host proxy over adb
adb shell settings put global http_proxy 127.0.0.1:8118
```

Because Avast also MITMs the tunneled TLS, the Avast root CA must be installed as a
**user CA** on the emulator (Settings → Security → Encryption & credentials → Install a
certificate → CA certificate) — debug builds trust it via the network security config.
Physical devices on a normal network need none of this.

To undo the proxy: `adb shell settings put global http_proxy :0`

## Security checklist (Firebase / Google Cloud Console)

Code-side hardening is done (locked-down `firestore.rules`, no secrets in source,
minimal `FileProvider` paths, PII-free error logs, 8-char minimum passwords). The
following can only be flipped in the consoles — do them once before sharing the
APK beyond the family:

1. **Publish the current `firestore.rules`** — Firebase Console → Firestore →
   Rules → paste the repo version → Publish. The repo copy is the source of
   truth; the console does not sync from git.
2. **App Check (Play Integrity)** — Firebase Console → App Check → register the
   Android app with the Play Integrity provider, then set Firestore + Auth
   enforcement to "Enforced". Blocks non-app clients even if the API key leaks
   (the key in `google-services.json` is an identifier, not a secret — App Check
   is what makes that safe).
3. **Restrict the API keys** — Google Cloud Console → APIs & Services →
   Credentials:
   - the **Gemini** key: restrict to the *Generative Language API* only;
   - the **Firebase Android** key: restrict to Android apps (package name +
     SHA-1) and to the Firebase APIs it actually uses (Identity Toolkit,
     Firestore, App Check).
4. **Auth hardening** — Firebase Console → Authentication → Settings: enable
   **email enumeration protection**, and set a **password policy** (min length ≥ 8
   to match the client-side check).
5. **WhatsApp bot secrets** — live only in Cloudflare (`wrangler secret`) and
   Meta's dashboard; nothing to configure in Firebase beyond generating the
   service-account key (see `whatsapp-bot/README.md`).
