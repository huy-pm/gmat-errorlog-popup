#!/usr/bin/env node
/**
 * Auto-increment the patch version in manifest.json before each build.
 * e.g. 3.0.0 → 3.0.1 → 3.0.2 ...
 */
const fs = require('fs');
const path = require('path');

const manifestPath = path.resolve(__dirname, '../public/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const parts = manifest.version.split('.').map(Number);
parts[2] += 1; // bump patch
manifest.version = parts.join('.');

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 4) + '\n');
console.log(`[bump-version] ${parts.join('.')}`)
