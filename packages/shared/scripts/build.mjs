import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = resolve(packageRoot, 'dist');

rmSync(distRoot, { recursive: true, force: true });
execFileSync('pnpm', ['exec', 'tsc', '-p', 'tsconfig.esm.json'], {
  cwd: packageRoot,
  stdio: 'inherit',
});
execFileSync('pnpm', ['exec', 'tsc', '-p', 'tsconfig.cjs.json'], {
  cwd: packageRoot,
  stdio: 'inherit',
});

mkdirSync(resolve(distRoot, 'esm'), { recursive: true });
mkdirSync(resolve(distRoot, 'cjs'), { recursive: true });

writeFileSync(
  resolve(distRoot, 'esm', 'package.json'),
  JSON.stringify({ type: 'module' }, null, 2) + '\n',
);
writeFileSync(
  resolve(distRoot, 'cjs', 'package.json'),
  JSON.stringify({ type: 'commonjs' }, null, 2) + '\n',
);
