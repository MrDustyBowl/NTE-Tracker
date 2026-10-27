// NTE Tracker v1.2: local image override, otherwise curated HTTPS image URL.
// We do not redistribute third-party character illustrations in public builds.
import catalog from '../portrait-sources.json';
const bundled = import.meta.glob('./assets/roster/*.{png,jpg,jpeg,webp}', { eager: true, query: '?url', import: 'default' });
const local = {};
for (const [path,url] of Object.entries(bundled)) {
  const name = path.split('/').pop().replace(/\.(png|jpg|jpeg|webp)$/i, '').toLowerCase();
  local[name] = url;
}
const normalize = name => String(name||'').toLowerCase().replaceAll('ll','l').replace(/[^a-z0-9]/g,'');
const remote = new Map(catalog.map(c=>[normalize(c.name), { url:c.url, fallback:c.fallback }]));
export function bundledArtworkFor(name) {
  const n = normalize(name);
  return local[n] || null;
}
export function remoteArtworkFor(name) {
  return remote.get(normalize(name)) || null;
}
