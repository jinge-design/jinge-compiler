const { promises: fs } = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const glob = require('glob');
const { transform } = require('esbuild');

const SRC_DIR = path.resolve(__dirname, '../src');
const LIB_DIR = path.resolve(__dirname, '../compiler');
execSync(`rm -rf ${LIB_DIR} && mkdir -p ${LIB_DIR}`);

function pglob(...args) {
  return new Promise((resolve, reject) => {
    glob(...args, (err, files) => {
      if (err) reject(err);
      resolve(files);
    });
  });
}
(async () => {
  const files = await pglob(path.join(SRC_DIR, '**/*.{ts,js}'));
  for await (const file of files) {
    let { code, map, warnings } = await transform(await fs.readFile(file, 'utf-8'), {
      loader: file.endsWith('.ts') ? 'ts' : 'js',
      target: ['es2020'],
      sourcemap: true,
    });
    warnings?.length && warnings.forEach((w) => console.warn(w));
    if (!code) {
      return;
    }
    let fn = path.relative(SRC_DIR, file);
    fn = fn.slice(0, fn.length - 3);
    execSync(`mkdir -p ${path.dirname(path.join(LIB_DIR, fn))}`);
    await fs.appendFile(path.join(LIB_DIR, fn + '.js'), code);
    await fs.appendFile(path.join(LIB_DIR, fn + '.js.map'), map);
  }
})().catch((err) => {
  console.error(err);
  process.exit(-1);
});
