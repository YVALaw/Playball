/*
  scripts/apk.cjs
  One command from source to an installable APK.

  The toolchain lives outside the repo and outside the shell's PATH on
  purpose — nothing here is installed system-wide, so a machine that builds
  Playball is not a machine whose environment has been quietly rearranged.
  This script supplies the two variables Gradle needs and gets out of the
  way. Point either at somewhere else with JAVA_HOME / ANDROID_HOME in the
  environment and those win.

  Usage:  npm run apk              debug build, installable straight away
          npm run apk:test         the same, with the testing shortcuts in
          npm run apk -- release   release APK — signed when the keys are present
          npm run aab              the signed release bundle the store takes

  Signing (stage 19). The keystore is the one thing this script never
  generates and the repo never holds (.gitignore): it lives wherever the
  reporter keeps it, and `android/keystore.properties` — ignored too, inside
  the generated shell — names it, four lines:

      storeFile=C:/Users/you/playball-keys/playball-release.jks
      storePassword=...
      keyAlias=playball
      keyPassword=...

  With that file present a release build is signed and `npm run aab` writes
  Playball-release.aab; without it the release APK is unsigned, as before,
  and a bundle is refused, because an unsigned bundle is not a thing Play
  accepts. The script checks the file exists and names the four keys; Gradle
  reads the values, and nothing here prints them. KEYSTORE_PROPERTIES in the
  environment points at a file somewhere else.
*/
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const home = process.env.USERPROFILE ?? process.env.HOME ?? '';

/** The JDK and SDK this project was built against, unless told otherwise. */
const JAVA_HOME = process.env.JAVA_HOME
  ?? path.join(home, 'AppData', 'Local', 'Java', 'jdk-21.0.12.1+1');
const ANDROID_HOME = process.env.ANDROID_HOME
  ?? path.join(home, 'AppData', 'Local', 'Android', 'Sdk');

for (const [label, dir] of [['JDK', JAVA_HOME], ['Android SDK', ANDROID_HOME]]) {
  if (!fs.existsSync(dir)) {
    console.error(`No ${label} at ${dir}. Set ${label === 'JDK' ? 'JAVA_HOME' : 'ANDROID_HOME'}.`);
    process.exit(1);
  }
}

const bundle = process.argv.includes('bundle');
const release = bundle || process.argv.includes('release');
const env = { ...process.env, JAVA_HOME, ANDROID_HOME, ANDROID_SDK_ROOT: ANDROID_HOME };
const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, env, stdio: 'inherit', shell: true });

// Gradle reads the SDK from here rather than from a wizard it cannot open.
fs.writeFileSync(
  path.join(ROOT, 'android', 'local.properties'),
  `sdk.dir=${ANDROID_HOME.replace(/\\/g, '\\\\')}\n`,
);

// `--test` builds the APK with the testing shortcuts in it (state/testBuild.ts);
// a plain `npm run apk` is the store build and carries none.
if (process.argv.includes('--test')) env.VITE_TEST_SHORTCUTS = '1';
console.log(`\n— building the web bundle${env.VITE_TEST_SHORTCUTS === '1' ? ' (test shortcuts in)' : ''} —`);
run('npm', ['run', 'build'], ROOT);
console.log('\n— copying it into the shell —');
run('npx', ['cap', 'sync', 'android'], ROOT);

// The launcher icon and the splash, regenerated from assets/ every build.
// The shell is generated and ignored (.gitignore), so its res/ came back as
// the default Capacitor placeholder — the blue X — on every clean build, and
// the store bundle wore it. The brand sources (the green ball, `assets/`)
// ARE tracked, and capacitor-assets rewrites the whole density ladder from
// them here, the same way this script supplies local.properties and the
// native Java: the generated tree is never edited by hand.
console.log('\n— painting the launcher icon and splash —');
run('npx', ['capacitor-assets', 'generate', '--android'], ROOT);

// The shell is generated and ignored, and `cap add android` writes a bare
// MainActivity. The two Java files the app actually needs — the activity that
// registers the back plugin, and the plugin (stage 18b, `05` §53) — are
// tracked under native/android and copied in here, the same way this script
// supplies local.properties: the generated tree is never edited by hand.
console.log('\n— supplying the shell its native sources —');
fs.cpSync(
  path.join(ROOT, 'native', 'android'),
  path.join(ROOT, 'android', 'app', 'src', 'main', 'java'),
  { recursive: true },
);
// By absolute path: with `shell: true` the command goes to cmd.exe, which
// will not reliably find a batch file sitting in the working directory.
const android = path.join(ROOT, 'android');
/*
  The Android version, pinned from package.json. The shell is generated and
  ignored, so its build.gradle came back as versionCode 1 / versionName "1.0"
  on every clean build and nothing tracked ever set them — a store cannot
  accept two uploads with the same versionCode (05 §62.3). Major.minor.patch
  becomes a monotonic code: 1.0.0 → 10000, 1.0.1 → 10001, 1.1.0 → 10100.
*/
{
  const version = String(require(path.join(ROOT, 'package.json')).version ?? '0.0.0');
  const [major = 0, minor = 0, patch = 0] = version.split('.').map((n) => parseInt(n, 10) || 0);
  const versionCode = major * 10000 + minor * 100 + patch;
  const gradle = path.join(android, 'app', 'build.gradle');
  if (fs.existsSync(gradle)) {
    const before = fs.readFileSync(gradle, 'utf8');
    const after = before
      .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
      .replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);
    fs.writeFileSync(gradle, after);
    console.log(`\n— version ${version} (code ${versionCode}) written to the shell —`);
  }
}
/*
  Signing, when the keys are present — see the header. The generated
  build.gradle gets a `signingConfigs.release` that reads the properties file
  at build time, and the release build type is pointed at it. Patched the way
  the version is: the shell is regenerated freely and never edited by hand.
*/
const keystoreProps = process.env.KEYSTORE_PROPERTIES ?? path.join(android, 'keystore.properties');
const signed = release && fs.existsSync(keystoreProps) && (() => {
  const text = fs.readFileSync(keystoreProps, 'utf8');
  return ['storeFile', 'storePassword', 'keyAlias', 'keyPassword']
    .every((k) => new RegExp(`^\\s*${k}\\s*=`, 'm').test(text));
})();
if (release) {
  const gradle = path.join(android, 'app', 'build.gradle');
  if (signed && fs.existsSync(gradle)) {
    let text = fs.readFileSync(gradle, 'utf8');
    if (!text.includes('signingConfigs {')) {
      const props = keystoreProps.replace(/\\/g, '/');
      text = text.replace(/    buildTypes \{/, `    signingConfigs {
        release {
            def keystore = new Properties()
            file('${props}').withInputStream { keystore.load(it) }
            storeFile file(keystore['storeFile'])
            storePassword keystore['storePassword']
            keyAlias keystore['keyAlias']
            keyPassword keystore['keyPassword']
        }
    }
    buildTypes {`);
      text = text.replace(/(buildTypes \{\s*\n\s*release \{)/, '$1\n            signingConfig signingConfigs.release');
      fs.writeFileSync(gradle, text);
    }
    console.log(`\n— signing the release with the keys named in ${keystoreProps} —`);
  } else if (bundle) {
    console.error(`\nA bundle has to be signed, and there is no usable ${keystoreProps}. See the header of this script.`);
    process.exit(1);
  } else {
    console.log('\n— no keystore.properties: the release APK will be unsigned —');
  }
}

const task = bundle ? 'bundleRelease' : release ? 'assembleRelease' : 'assembleDebug';
console.log(`\n— ${bundle ? 'building the signed release bundle' : `assembling the ${release ? 'release' : 'debug'} APK`} —`);
run(`"${path.join(android, 'gradlew.bat')}"`, [task], android);

const artifact = bundle
  ? ['bundle', 'release', 'app-release.aab']
  : ['apk', release ? 'release' : 'debug',
    release ? (signed ? 'app-release.apk' : 'app-release-unsigned.apk') : 'app-debug.apk'];
const out = path.join(ROOT, 'android', 'app', 'build', 'outputs', ...artifact);
if (!fs.existsSync(out)) {
  console.error(`\nGradle finished but nothing landed at ${out}`);
  process.exit(1);
}
// Somewhere a person can actually find it.
const dest = path.join(ROOT, bundle
  ? 'Playball-release.aab'
  : `Playball-${release ? (signed ? 'release' : 'release-unsigned') : 'debug'}.apk`);
fs.copyFileSync(out, dest);
console.log(`\n${dest}  (${(fs.statSync(dest).size / 1024 / 1024).toFixed(1)} MB)`);
