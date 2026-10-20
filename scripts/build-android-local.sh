#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
export PATH="$(dirname "$(command -v node)"):$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
export NODE_ENV=production

# Expo loads .env.local itself. Fail before producing a nonfunctional app.
node -e 'require("@expo/env").load(process.cwd()); for (const name of ["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]) if (!process.env[name]) throw new Error("Missing " + name + "; use ignored .env.local or environment variables")'
case "${1:-apk}" in
  apk)
    # Random local preview identity and password remain in ignored storage.
    mkdir -p local-builds/android
    password_file=local-builds/android/local-preview.password
    if [[ ! -f "$password_file" ]]; then
      (umask 077; node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))' > "$password_file")
    fi
    export PULSE_LOCAL_STORE_PASSWORD="$(cat "$password_file")"
    if [[ ! -f local-builds/android/local-preview.keystore ]]; then
      (umask 077; keytool -genkeypair -noprompt -keystore local-builds/android/local-preview.keystore -storepass:env PULSE_LOCAL_STORE_PASSWORD -alias pulse-local -keypass:env PULSE_LOCAL_STORE_PASSWORD -dname 'CN=Pulse Local Preview,O=ScienceByHugs,C=US' -keyalg RSA -keysize 2048 -validity 10000)
    fi
    # Bundle JavaScript into the APK so it can run without Metro.
    ./android/gradlew -p android :app:assemblePreview :app:lintPreview -PreactNativeArchitectures=arm64-v8a --no-daemon --console=plain
    artifact=android/app/build/outputs/apk/preview/app-preview.apk
    "$ANDROID_HOME/build-tools/37.0.0/apksigner" verify "$artifact"
    "$ANDROID_HOME/build-tools/37.0.0/zipalign" -c -P 16 -v 4 "$artifact"
    ;;
  aab)
    : "${PULSE_UPLOAD_STORE_FILE:?Set absolute path to owner-controlled upload keystore}"
    : "${PULSE_UPLOAD_STORE_PASSWORD:?Required}"
    : "${PULSE_UPLOAD_KEY_ALIAS:?Required}"
    : "${PULSE_UPLOAD_KEY_PASSWORD:?Required}"
    ./android/gradlew -p android :app:bundleRelease :app:lintRelease --no-daemon --console=plain
    artifact=android/app/build/outputs/bundle/release/app-release.aab
    jarsigner -verify "$artifact"
    ;;
  *) echo 'Usage: build-android-local.sh apk|aab' >&2; exit 2 ;;
esac
mkdir -p local-builds/android
cp "$artifact" local-builds/android/
shasum -a 256 "$artifact"
echo "Artifact copied to local-builds/android/ (ignored by Git)."
