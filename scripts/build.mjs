/**
 * Next Move Vercel build: combine local styles and JS into one hosted static file.
 * Usage: node scripts/build.mjs --hosted-email
 * Never loads any participant answers or sends network requests.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = name => readFileSync(resolve(root, 'src', name), 'utf8');
const hosted = process.argv.includes('--hosted-email');
const assertReplace = (text, search, replacement) => {
  if (!text.includes(search)) throw new Error(`[Next Move build] Missing expected input: ${search}`);
  return text.replace(search, replacement);
};
let html = src('index.html');
html = assertReplace(html, '<link rel="stylesheet" href="styles.css">', `<style>\n${src('styles.css')}\n</style>`);
html = assertReplace(html, '  <script src="data.js" defer></script>\n', '');
html = assertReplace(html, '  <script src="app.js" defer></script>\n', '');
if (hosted) {
  html = assertReplace(html, 'emailApiEnabled: false', 'emailApiEnabled: true');
  html = assertReplace(html, "connect-src 'none'", "connect-src 'self'");
}
html = assertReplace(html, '</body>', `<script>\n${src('data.js')}\n</script>\n<script>\n${src('app.js')}\n</script>\n</body>`);
const output = hosted ? resolve(root, 'public/index.html') : resolve(root, 'Next-Move.html');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, html, 'utf8');
console.log(`[Next Move] ${hosted?'Hosted (opt-in email)':'Offline (no network)'} release built: ${output}`);
console.log(`[Next Move] Output bytes: ${Buffer.byteLength(html,'utf8')}`);
