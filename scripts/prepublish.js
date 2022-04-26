const { execSync } = require('child_process');

const { NPM_TAG, NPM_VERSION } = process.env;

(async () => {
  const betaTag = NPM_TAG?.trim() === 'beta';
  let version = NPM_VERSION;
  if (!version) {
    const info = JSON.parse(execSync('npm info jinge-compiler dist-tags --json'));
    console.log('NPM_INFO:', info);
    version = (betaTag ? info.beta : info.latest).replace(/\d+$/, (m) => Number(m) + 1);
  }

  if (!betaTag) {
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
      console.error('master 分支只能发布正式版，版本号满足 x.x.x');
      process.exit(-1);
    }
  } else {
    if (!/^\d+\.\d+\.\d+-beta\.\d+$/.test(version)) {
      console.error('非 master 分支只能发布 Beta 版，版本号必须满足 x.x.x-beta.x');
      process.exit(-1);
    }
  }
  const pkgFile = path.resolve(__dirname, '../package.json');
  let pkgCnt = readFileSync(pkgFile, 'utf-8');
  pkgCnt = pkgCnt.replace(/"version"\s*:\s*"[^"]+"/, `"version": "${version}"`);
  console.log('NPM_PUBLISH_VERSION:', version);
  writeFileSync(pkgFile, pkgCnt);
})().catch((err) => {
  console.error(err);
  process.exit(-1);
});
