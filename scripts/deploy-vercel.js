import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

try {
  console.log('Building gta-clone...');
  execSync('pnpm --filter @workspace/gta-clone build', { stdio: 'inherit' });

  const src = path.join(process.cwd(), 'artifacts/gta-clone/dist/public');
  const dest = path.join(process.cwd(), 'public');

  console.log(`Copying from ${src} to ${dest}...`);

  if (fs.existsSync(dest)) {
    console.log('Removing existing public directory...');
    fs.rmSync(dest, { recursive: true, force: true });
  }

  fs.mkdirSync(dest, { recursive: true });
  
  // Copy recursive
  const copyRecursive = (source, destination) => {
    if (!fs.existsSync(source)) {
      throw new Error(`Source path does not exist: ${source}`);
    }
    const stats = fs.statSync(source);
    if (stats.isDirectory()) {
      if (!fs.existsSync(destination)) {
        fs.mkdirSync(destination);
      }
      fs.readdirSync(source).forEach(child => {
        copyRecursive(path.join(source, child), path.join(destination, child));
      });
    } else {
      fs.copyFileSync(source, destination);
    }
  };

  copyRecursive(src, dest);
  console.log('Deployment build successful!');
} catch (error) {
  console.error('Deployment build failed:', error.message);
  process.exit(1);
}
