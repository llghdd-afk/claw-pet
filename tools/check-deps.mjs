/**
 * Dependency Checker — Auto-detect and install missing tools
 * 
 * Usage: node tools/check-deps.mjs [--fix]
 * 
 * Checks: Node.js, npm, Python, Rust/Cargo, Tauri CLI, Electron
 * With --fix: auto-installs what's missing
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const IS_FIX = process.argv.includes('--fix');

const DEPS = [
  {
    name: 'Node.js',
    check: () => execSync('node --version', { encoding: 'utf-8' }).trim(),
    install: 'Download from https://nodejs.org/',
    required: true,
  },
  {
    name: 'npm',
    check: () => execSync('npm --version', { encoding: 'utf-8' }).trim(),
    install: 'Comes with Node.js',
    required: true,
  },
  {
    name: 'Python 3',
    check: () => execSync('python3 --version || python --version', { encoding: 'utf-8' }).trim(),
    install: IS_FIX ? 'sudo apt install -y python3 || brew install python3' : 'https://python.org/',
    required: false,
  },
  {
    name: 'Rust/Cargo',
    check: () => execSync('rustc --version', { encoding: 'utf-8' }).trim(),
    install: IS_FIX ? 'curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh' : 'https://rustup.rs/',
    required: false,
  },
  {
    name: 'electron-builder',
    check: () => execSync('npx electron-builder --version', { encoding: 'utf-8' }).trim(),
    install: 'npm install --save-dev electron-builder',
    required: false,
  },
];

console.log('🔍 ClawPet Dependency Check');
console.log('═'.repeat(40));

let allGood = true;

for (const dep of DEPS) {
  let version;
  try {
    version = dep.check();
  } catch {
    version = null;
  }

  if (version) {
    console.log(`  ✅ ${dep.name}: ${version}`);
  } else {
    console.log(`  ❌ ${dep.name}: NOT FOUND${dep.required ? ' (REQUIRED)' : ''}`);
    if (dep.required) allGood = false;

    if (IS_FIX && dep.install) {
      console.log(`     🔧 Installing...`);
      try {
        execSync(dep.install, { stdio: 'inherit' });
        console.log(`     ✅ ${dep.name} installed`);
      } catch (e) {
        console.log(`     ❌ Failed to install ${dep.name}`);
        console.log(`     📝 Manual install: ${dep.install}`);
      }
    } else if (!IS_FIX) {
      console.log(`     📝 Install: ${dep.install}`);
    }
  }
}

// Check npm dependencies
console.log('');
console.log('📦 Checking npm dependencies...');
const pkgPath = path.join(process.cwd(), 'package.json');
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  if (fs.existsSync(path.join(process.cwd(), 'node_modules'))) {
    let missing = 0;
    for (const [name] of Object.entries(allDeps)) {
      const modPath = path.join(process.cwd(), 'node_modules', name);
      if (!fs.existsSync(modPath)) {
        console.log(`  ❌ Missing: ${name}`);
        missing++;
      }
    }
    if (missing === 0) {
      console.log('  ✅ All npm packages installed');
    } else if (IS_FIX) {
      console.log(`  🔧 Running npm install...`);
      execSync('npm install', { stdio: 'inherit' });
    }
  } else if (IS_FIX) {
    console.log('  🔧 node_modules not found, running npm install...');
    execSync('npm install', { stdio: 'inherit' });
  } else {
    console.log('  ❌ node_modules not found. Run: npm install');
  }
}

console.log('');
if (allGood) {
  console.log('✅ All required dependencies are available');
} else {
  console.log('⚠️  Some required dependencies are missing');
  console.log('   Run: node tools/check-deps.mjs --fix');
  process.exit(1);
}
