import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

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

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const [source, target] of publishFiles) {
  await cp(resolve(root, source), resolve(output, target));
}
console.log(`Static publish directory contains only: ${publishFiles.map(([, target]) => target).join(', ')}`);
