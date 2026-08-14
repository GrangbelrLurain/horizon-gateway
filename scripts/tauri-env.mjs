import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env');

// Read and parse .env file
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // Split by first '='
    const index = trimmed.indexOf('=');
    if (index !== -1) {
      const key = trimmed.slice(0, index).trim();
      const val = trimmed.slice(index + 1).trim();
      // Remove surrounding quotes if any
      const cleanedVal = val.replace(/^(['"])(.*)\1$/, '$2');
      process.env[key] = cleanedVal;
    }
  }
}

const cliPath = path.join(__dirname, '../node_modules/@tauri-apps/cli/tauri.js');
const args = process.argv.slice(2);
const tauriDir = path.join(__dirname, '../src-tauri');

if (args[0] === 'dev') {
  const cargo = spawnSync(
    'cargo',
    ['build', '-p', 'horizon-gateway-serve', '-p', 'hgc'],
    { cwd: tauriDir, stdio: 'inherit', shell: process.platform === 'win32' },
  );
  if (cargo.status !== 0) {
    console.warn(
      '[tauri] cargo build -p horizon-gateway-serve failed. If the exe is locked, stop horizon-gateway-serve and retry.',
    );
  }
}
const defaultConfig = path.join(__dirname, '../src-tauri/hg-gui/tauri.conf.json');
const configFlag = ['--config', '-c'];
const hasConfig = args.some((a, i) => configFlag.includes(a) || (i > 0 && configFlag.includes(args[i - 1])));
// Tauri CLI v2 expects: `tauri dev --config path` (config follows the subcommand).
const tauriArgs = hasConfig || args.length === 0
  ? args
  : [args[0], '--config', defaultConfig, ...args.slice(1)];

const child = spawn(process.execPath, [cliPath, ...tauriArgs], { stdio: 'inherit' });

child.on('close', (code) => {
  process.exit(code);
});
