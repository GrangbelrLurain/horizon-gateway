import { spawn } from 'child_process';
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

const child = spawn(process.execPath, [cliPath, ...args], { stdio: 'inherit' });

child.on('close', (code) => {
  process.exit(code);
});
