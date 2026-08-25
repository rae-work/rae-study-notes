#!/bin/bash
# ============================================================
# 一键打包 APK —— 在 Ubuntu/Debian 或 WSL 上运行
# 用法:  ./build-apk.sh  你的App.html  "App名字"  com.你的.包名
# 例:    ./build-apk.sh  thai.html  "泰语学习"  com.mystore.thai
# ============================================================
set -e
HTML="${1:?用法: ./build-apk.sh 内容.html \"App名字\" com.你的.包名}"
LABEL="${2:-Language App}"
PKG="${3:-com.mystore.langapp}"
OUT="$(echo "$LABEL" | tr -d ' /')".apk

# --- 首次运行自动装工具链(约 200MB,只装一次) ---
if ! command -v aapt >/dev/null || ! command -v dalvik-exchange >/dev/null; then
  echo ">> 安装安卓构建工具(仅首次)..."
  sudo apt-get update -q
  sudo apt-get install -y aapt apksigner zipalign dalvik-exchange \
       android-sdk-platform-23 openjdk-17-jdk-headless
fi

AJ=/usr/lib/android-sdk/platforms/android-23/android.jar
W=$(mktemp -d); DIR="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$W"/{src,res/values,assets,out/classes}
cp -r "$DIR"/app/src/main/java/* "$W/src/"
cp -r "$DIR"/app/src/main/res/mipmap-* "$W/res/"
cp "$HTML" "$W/assets/index.html"

# 包名替换
find "$W/src" -name '*.java' -exec sed -i "s/package com\.ruangbelajar\.app;/package $PKG;/" {} \;
NEWDIR="$W/src2/$(echo $PKG | tr '.' '/')"; mkdir -p "$NEWDIR"
mv "$W/src"/*/*/*/*.java "$NEWDIR/" 2>/dev/null || find "$W/src" -name '*.java' -exec mv {} "$NEWDIR/" \;

cat > "$W/res/values/strings.xml" <<EOF
<?xml version="1.0" encoding="utf-8"?>
<resources><string name="app_name">$LABEL</string></resources>
EOF
cat > "$W/res/values/colors.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<resources><color name="app_bg">#FF13302F</color></resources>
EOF
cat > "$W/res/values/styles.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<resources><style name="AppTheme" parent="@android:style/Theme.Holo.Light.NoActionBar">
<item name="android:windowBackground">@color/app_bg</item></style></resources>
EOF
cat > "$W/AndroidManifest.xml" <<EOF
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="$PKG" android:versionCode="1" android:versionName="1.0">
    <uses-sdk android:minSdkVersion="19" android:targetSdkVersion="33" />
    <supports-screens android:smallScreens="true" android:normalScreens="true"
        android:largeScreens="true" android:xlargeScreens="true" android:anyDensity="true" />
    <application android:allowBackup="true" android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name" android:hardwareAccelerated="true" android:theme="@style/AppTheme">
        <activity android:name="$PKG.MainActivity" android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden|screenLayout|smallestScreenSize"
            android:windowSoftInputMode="adjustResize" android:label="@string/app_name">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
EOF

echo ">> 编译..."
javac -source 8 -target 8 -nowarn -bootclasspath $AJ -cp $AJ -d "$W/out/classes" $(find "$W/src2" -name '*.java') 2>/dev/null
dalvik-exchange --dex --min-sdk-version=19 --output="$W/out/classes.dex" "$W/out/classes"
aapt package -f -M "$W/AndroidManifest.xml" -S "$W/res" -A "$W/assets" -I $AJ -F "$W/out/u.apk"
(cd "$W/out" && aapt add u.apk classes.dex >/dev/null)

# 口令不写死在脚本里（这个仓库是公开的）。跑之前先 export：
#   export KEYSTORE_PASSWORD=...
KS="$DIR/release.keystore"
: "${KEYSTORE_PASSWORD:?需要先 export KEYSTORE_PASSWORD}"
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -storepass "$KEYSTORE_PASSWORD" -keypass "$KEYSTORE_PASSWORD" \
    -alias appkey -keyalg RSA -keysize 2048 -validity 10950 -dname "CN=$LABEL, O=App, C=CN"
fi
zipalign -f -p 4 "$W/out/u.apk" "$W/out/a.apk"
apksigner sign --ks "$KS" --ks-pass "pass:$KEYSTORE_PASSWORD" --key-pass "pass:$KEYSTORE_PASSWORD" \
  --ks-key-alias appkey --v1-signing-enabled true --v2-signing-enabled true \
  --v3-signing-enabled true --min-sdk-version 19 --out "$DIR/$OUT" "$W/out/a.apk"
apksigner verify --min-sdk-version 19 "$DIR/$OUT"
rm -rf "$W"
echo "✓ 完成: $DIR/$OUT"
