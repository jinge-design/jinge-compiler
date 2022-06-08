const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const v = require('antlr4-build/package.json').version.split('-')[0];
const jar = require.resolve(`antlr4-build/bin/antlr-${v}-complete.jar`);

const cwd = path.resolve(__dirname, '../src/template/parser');
execSync('rm -f *.js *.interp *.tokens', { cwd });
execSync(`java -jar ${jar} -Dlanguage=JavaScript -no-listener -visitor *.g4`, {
  cwd,
});
fs.readdirSync(cwd).forEach((file) => {
  if (!file.endsWith('.js')) return;
  const cnt = fs.readFileSync(path.join(cwd, file), 'utf-8').replace(/import\s+(?:\w+)\s+from\s+['"]antlr4['"]/g, (m0) => {
    return m0.replace("'antlr4'", "'antlr4-build'");
  });
  fs.writeFileSync(path.join(cwd, file), cnt);
});
