import { mkdir, copyFile, cp } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'firebase-config.js']) await copyFile(file, `dist/${file}`);
for (const directory of ['src', 'assets']) await cp(directory, `dist/${directory}`, { recursive: true });
console.log('Site construit dans dist ; les clés et le code serveur restent hors du dossier public.');
