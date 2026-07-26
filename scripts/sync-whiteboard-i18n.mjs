import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const targets = ['whiteboard.html', 'whiteboard-pro.html'];
const sources = ['i18n.js', 'zh-CN.js', 'en-US.js', 'whiteboard-phrases.js'];
const start = '<!-- WB_I18N_BUNDLE_START -->';
const end = '<!-- WB_I18N_BUNDLE_END -->';

const source = (await Promise.all(sources.map(name=>readFile(resolve(root, 'locales', name), 'utf8'))))
  .join('\n')
  .replaceAll('</script', '<\\/script');
const bundle = `${start}\n<script data-whiteboard-i18n>\ntry {\n${source}\n} catch (error) {\n  window.__wbI18nError = String(error && (error.stack || error.message) || error);\n  console.error('WhiteBoard i18n failed to initialize', error);\n}\n</script>\n${end}`;
const externalPattern = /  <script src="\.\/locales\/i18n\.js"><\/script>\n  <script src="\.\/locales\/zh-CN\.js"><\/script>\n  <script src="\.\/locales\/en-US\.js"><\/script>\n  <script src="\.\/locales\/whiteboard-phrases\.js"><\/script>/;

for(const name of targets){
  const path = resolve(root, name);
  let html = await readFile(path, 'utf8');
  const markerStart = html.indexOf(start);
  const markerEnd = html.indexOf(end);
  if(markerStart >= 0 && markerEnd > markerStart){
    html = html.slice(0, markerStart) + bundle + html.slice(markerEnd + end.length);
  }else if(externalPattern.test(html)){
    html = html.replace(externalPattern, ()=>bundle);
  }else{
    throw new Error(`${name}: i18n insertion point not found`);
  }
  await writeFile(path, html);
}

console.log(`Synced self-contained i18n bundle into ${targets.join(' and ')}`);
