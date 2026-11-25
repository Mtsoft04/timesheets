import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'src/client');
const outputDir = path.join(root, 'public/assets');
const sourceFiles = (await readdir(sourceDir)).filter((file) => file.endsWith('.js')).sort();

await mkdir(outputDir, { recursive: true });
const sections = await Promise.all(sourceFiles.map(async (file) => {
  const source = await readFile(path.join(sourceDir, file), 'utf8');
  return `\n/* ===== ${file} ===== */\n${source.trim()}\n`;
}));
const bundle = sections.join('\n');
// The feature modules share one browser scope; reject duplicate globals and
// syntax errors before publishing a bundle that would prevent the app booting.
new Script(bundle, { filename: 'public/assets/workspace.js' });
await writeFile(path.join(outputDir, 'workspace.js'), bundle, 'utf8');
await copyFile(path.join(root, 'src/styles/workspace.css'), path.join(outputDir, 'workspace.css'));
console.log(`Built workspace client from ${sourceFiles.length} feature files.`);
