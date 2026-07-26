import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, '.render-static');
const publishFiles = [
  ['index.html', 'index.html'],
  ['accounts.json', 'accounts.json'],
  ['paywall.json', 'paywall.json'],
  ['whiteboard-pro.html', 'app.html'],
  ['account-admin.html', 'account-admin.html'],
  ['account-admin1.html', 'account-admin1.html'],
];
const publishDirs = [
  ['locales', 'locales'],
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const [source, target] of publishFiles) {
  await cp(resolve(root, source), resolve(output, target));
}
for (const [source, target] of publishDirs) {
  await cp(resolve(root, source), resolve(output, target), { recursive: true });
}
const published = [
  ...publishFiles.map(([, target]) => target),
  ...publishDirs.map(([, target]) => target + '/'),
];
console.log(`Static publish directory contains only: ${published.join(', ')}`);
