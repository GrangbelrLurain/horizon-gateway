import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const srcIcon = path.join(rootDir, 'public', 'app-icon.svg');
const srcLogo = path.join(rootDir, 'public', 'logo-text.svg');

const destIcon = path.join(rootDir, 'website', 'public', 'favicon.svg');
const destLogo = path.join(rootDir, 'website', 'public', 'logo-text.svg');

try {
  // Ensure website/public directory exists
  fs.mkdirSync(path.dirname(destIcon), { recursive: true });

  if (fs.existsSync(srcIcon)) {
    fs.copyFileSync(srcIcon, destIcon);
    console.log('[Logo Sync] Copied app-icon.svg -> website/public/favicon.svg');
  } else {
    console.warn('[Logo Sync] Source app-icon.svg not found');
  }

  if (fs.existsSync(srcLogo)) {
    fs.copyFileSync(srcLogo, destLogo);
    console.log('[Logo Sync] Copied logo-text.svg -> website/public/logo-text.svg');
  } else {
    console.warn('[Logo Sync] Source logo-text.svg not found');
  }
} catch (err) {
  console.error('[Logo Sync] Failed to sync logo assets:', err);
  process.exit(1);
}
