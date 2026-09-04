/*
  scripts/apk.cjs
  One command from source to an installable APK.

  The toolchain lives outside the repo and outside the shell's PATH on
  purpose — nothing here is installed system-wide, so a machine that builds
  Playball is not a machine whose environment has been quietly rearranged.
  This script supplies the two variables Gradle needs and gets out of the
  way. Point either at somewhere else with JAVA_HOME / ANDROID_HOME in the
  environment and those win.

  Usage:  npm run apk          debug build, installable straight away
          npm run apk -- release   unsigned release; stage 19 owns signing
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

const release = process.argv.includes('release');
const env = { ...process.env, JAVA_HOME, ANDROID_HOME, ANDROID_SDK_ROOT: ANDROID_HOME };
const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, env, stdio: 'inherit', shell: true });

// Gradle reads the SDK from here rather than from a wizard it cannot open.
fs.writeFileSync(
  path.join(ROOT, 'android', 'local.properties'),
  `sdk.dir=${ANDROID_HOME.replace(/\\/g, '\\\\')}\n`,
);

console.log('\n— building the web bundle —');
run('npm', ['run', 'build'], ROOT);
console.log('\n— copying it into the shell —');
run('npx', ['cap', 'sync', 'android'], ROOT);
console.log(`\n— assembling the ${release ? 'release' : 'debug'} APK —`);
// By absolute path: with `shell: true` the command goes to cmd.exe, which
// will not reliably find a batch file sitting in the working directory.
const android = path.join(ROOT, 'android');
run(`"${path.join(android, 'gradlew.bat')}"`,
  [release ? 'assembleRelease' : 'assembleDebug'], android);

const out = path.join(
  ROOT, 'android', 'app', 'build', 'outputs', 'apk',
  release ? 'release' : 'debug',
  release ? 'app-release-unsigned.apk' : 'app-debug.apk',
);
if (!fs.existsSync(out)) {
  console.error('\nGradle finished but no APK landed at ' + out);
  process.exit(1);
}
// Somewhere a person can actually find it.
const dest = path.join(ROOT, `Playball-${release ? 'release-unsigned' : 'debug'}.apk`);
fs.copyFileSync(out, dest);
console.log(`\n${dest}  (${(fs.statSync(dest).size / 1024 / 1024).toFixed(1)} MB)`);
