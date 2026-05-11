/**
 * esbuild configuration for ClawPet renderer bundle
 * Bundles all pet engine code into a single JS file for Electron renderer
 */

import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';

const IS_DEV = process.argv.includes('--dev');

await esbuild.build({
  entryPoints: ['renderer/app.js'],
  bundle: true,
  outfile: 'renderer/bundle.js',
  format: 'iife',
  globalName: 'ClawPetApp',
  minify: !IS_DEV,
  sourcemap: IS_DEV,
  target: ['chrome110'],
  define: {
    'process.env.NODE_ENV': IS_DEV ? '"development"' : '"production"',
  },
  logLevel: 'info',
});

console.log('✅ Renderer bundled to renderer/bundle.js');
