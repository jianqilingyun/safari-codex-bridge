#!/bin/bash
# Build only. Installing or launching the output is a separate user action.
set -euo pipefail
BRIDGE_SOURCE="$(cd "$(dirname "$0")/.." && pwd)"
BRIDGE_WORK="${BRIDGE_WORK:-$BRIDGE_SOURCE/build.noindex}"
BRIDGE_BUNDLE_PREFIX="${BRIDGE_BUNDLE_PREFIX:-local.codex.safari.context}"
BRIDGE_TEAM_ID="${BRIDGE_TEAM_ID:-}"
BRIDGE_SIGN_IDENTITY="${BRIDGE_SIGN_IDENTITY:-}"
BRIDGE_ARCHS="${BRIDGE_ARCHS:-arm64 x86_64}"
BRIDGE_UNSIGNED=false
BRIDGE_AD_HOC=false
case "${1:-}" in
  --unsigned) BRIDGE_UNSIGNED=true; shift ;;
  --ad-hoc) BRIDGE_AD_HOC=true; shift ;;
esac
if [[ $# -ne 0 ]]; then printf 'Usage: scripts/build.sh [--unsigned | --ad-hoc]\n' >&2; exit 2; fi
if [[ "$BRIDGE_AD_HOC" == true ]]; then
  # Never reuse the maintainer's certificate or team in a public test package.
  BRIDGE_TEAM_ID=ADHOCTEST0
  BRIDGE_SIGN_IDENTITY=-
fi
if [[ ! "$BRIDGE_BUNDLE_PREFIX" =~ ^[A-Za-z0-9]+([.-][A-Za-z0-9]+)+$ ]]; then
  printf 'Invalid BRIDGE_BUNDLE_PREFIX\n' >&2; exit 2
fi
if [[ "$BRIDGE_UNSIGNED" == false && ( ! "$BRIDGE_TEAM_ID" =~ ^[A-Z0-9]{10}$ || -z "$BRIDGE_SIGN_IDENTITY" ) ]]; then
  printf 'Set BRIDGE_TEAM_ID and BRIDGE_SIGN_IDENTITY to your own Apple signing identity. Use --unsigned for build checks only.\n' >&2; exit 2
fi
for BRIDGE_ARCH in $BRIDGE_ARCHS; do
  [[ "$BRIDGE_ARCH" == arm64 || "$BRIDGE_ARCH" == x86_64 ]] || { printf 'Unsupported architecture\n' >&2; exit 2; }
done
[[ -n "$BRIDGE_ARCHS" ]] || { printf 'Set BRIDGE_ARCHS\n' >&2; exit 2; }
BRIDGE_APP_GROUP="${BRIDGE_TEAM_ID:-UNSIGNED00}.$BRIDGE_BUNDLE_PREFIX"
BRIDGE_PROJECT="$BRIDGE_SOURCE/native/Safari-Codex-Bridge/Safari-Codex-Bridge.xcodeproj"
mkdir -p "$BRIDGE_WORK"
if ! xcodebuild -project "$BRIDGE_PROJECT" -scheme Safari-Codex-Bridge -configuration Release \
  -destination 'platform=macOS' -derivedDataPath "$BRIDGE_WORK/DerivedData" \
  CODE_SIGNING_ALLOWED=NO ENABLE_DEBUG_DYLIB=NO ONLY_ACTIVE_ARCH=NO ARCHS="$BRIDGE_ARCHS" \
  BRIDGE_BUNDLE_PREFIX="$BRIDGE_BUNDLE_PREFIX" BRIDGE_APP_GROUP="$BRIDGE_APP_GROUP" build > "$BRIDGE_WORK/build.log" 2>&1; then
  tail -60 "$BRIDGE_WORK/build.log" >&2; exit 1
fi
BRIDGE_APP="$BRIDGE_WORK/DerivedData/Build/Products/Release/Safari-Codex-Bridge.app"
BRIDGE_HELPER="$BRIDGE_APP/Contents/Library/LoginItems/SafariChatHelper.app"
mkdir -p "$BRIDGE_HELPER/Contents/MacOS" "$BRIDGE_HELPER/Contents/Resources" "$BRIDGE_WORK/SwiftCache"
cp "$BRIDGE_SOURCE/chat-runtime/Info.plist" "$BRIDGE_HELPER/Contents/Info.plist"
# The helper exits when its version differs from the host. Keep packaged values
# synchronized with the built host rather than relying on manual plist edits.
for BRIDGE_VERSION_KEY in CFBundleShortVersionString CFBundleVersion; do
  BRIDGE_VERSION_VALUE=$(/usr/libexec/PlistBuddy -c "Print :$BRIDGE_VERSION_KEY" "$BRIDGE_APP/Contents/Info.plist")
  /usr/libexec/PlistBuddy -c "Set :$BRIDGE_VERSION_KEY $BRIDGE_VERSION_VALUE" "$BRIDGE_HELPER/Contents/Info.plist"
done
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier $BRIDGE_BUNDLE_PREFIX.ChatHelper" "$BRIDGE_HELPER/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Add :BridgeAppGroup string $BRIDGE_APP_GROUP" "$BRIDGE_HELPER/Contents/Info.plist"
cp "$BRIDGE_SOURCE/chat-runtime/worker.py" "$BRIDGE_HELPER/Contents/Resources/worker.py"
# Use the user's installed official Codex. No OpenAI binary or credentials are
# redistributed. Detection and protocol checks are handled by worker.py.
rm -rf "$BRIDGE_HELPER/Contents/Resources/runtime"
BRIDGE_PARTS=()
for BRIDGE_ARCH in $BRIDGE_ARCHS; do
  BRIDGE_PART="$BRIDGE_WORK/SafariChatHelper-$BRIDGE_ARCH"
  swiftc -parse-as-library -module-cache-path "$BRIDGE_WORK/SwiftCache" -target "$BRIDGE_ARCH-apple-macosx13.0" \
    -framework Cocoa -framework ApplicationServices "$BRIDGE_SOURCE/chat-runtime/ChatHelper.swift" \
    "$BRIDGE_SOURCE/chat-runtime/Dictation.swift" "$BRIDGE_SOURCE/chat-runtime/CommandQueue.swift" "$BRIDGE_SOURCE/chat-runtime/Workspaces.swift" -o "$BRIDGE_PART"
  BRIDGE_PARTS+=("$BRIDGE_PART")
done
lipo -create "${BRIDGE_PARTS[@]}" -output "$BRIDGE_HELPER/Contents/MacOS/SafariChatHelper"
if [[ "$BRIDGE_UNSIGNED" == false ]]; then
  BRIDGE_ENTITLEMENTS=("chat-runtime/Helper.entitlements" "native/Safari-Codex-Bridge/Safari-Codex-Bridge Extension/Bridge.entitlements" "native/Safari-Codex-Bridge/Safari-Codex-Bridge/Bridge.entitlements")
  BRIDGE_TARGETS=("$BRIDGE_HELPER" "$BRIDGE_APP/Contents/PlugIns/Safari-Codex-Bridge Extension.appex" "$BRIDGE_APP")
  for BRIDGE_INDEX in 0 1 2; do
    BRIDGE_ENTITLEMENT="$BRIDGE_WORK/entitlements-$BRIDGE_INDEX.plist"
    sed "s/\$(BRIDGE_APP_GROUP)/$BRIDGE_APP_GROUP/g" "$BRIDGE_SOURCE/${BRIDGE_ENTITLEMENTS[$BRIDGE_INDEX]}" > "$BRIDGE_ENTITLEMENT"
    codesign --force --sign "$BRIDGE_SIGN_IDENTITY" --options runtime --entitlements "$BRIDGE_ENTITLEMENT" "${BRIDGE_TARGETS[$BRIDGE_INDEX]}"
  done
  codesign --verify --deep --strict "$BRIDGE_APP"
  ditto -c -k --sequesterRsrc --keepParent "$BRIDGE_APP" "$BRIDGE_WORK/Safari-Codex-Bridge-Mac.zip"
  if [[ "$BRIDGE_AD_HOC" == true ]]; then
    printf 'Ad hoc test build (not notarized; Safari developer settings required): %s\n' "$BRIDGE_APP"
  else
    printf 'Signed build (not notarized): %s\n' "$BRIDGE_APP"
  fi
else
  printf 'Unsigned build check only: %s\n' "$BRIDGE_APP"
fi
