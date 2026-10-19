import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'dist');
const pages = JSON.parse(await readFile(path.join(root, 'src/data/seo-pages.json'), 'utf8'));
const baseHtml = await readFile(path.join(outputDir, 'index.html'), 'utf8');
const siteUrl = 'https://divinevisioninfra.com';
const socialImage = `${siteUrl}/hero/hero-loop-still.jpg`;

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function replaceOrInsert(html, pattern, replacement, insertionAnchor) {
  if (pattern.test(html)) return html.replace(pattern, replacement);
  return html.replace(insertionAnchor, (match) => `${replacement}\n    ${match}`);
}

function htmlForPage(page) {
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description);
  const canonical = `${siteUrl}${page.path}`;
  let html = baseHtml.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);

  html = replaceOrInsert(
    html,
    /<meta\s+name="description"[^>]*>/,
    `<meta name="description" content="${description}" />`,
    '</head>',
  );
  html = replaceOrInsert(
    html,
    /<link\s+rel="canonical"[^>]*>/,
    `<link rel="canonical" href="${canonical}" />`,
    '</head>',
  );

  const tags = [
    ['property', 'og:title', title],
    ['property', 'og:description', description],
    ['property', 'og:url', canonical],
    ['property', 'og:image', socialImage],
    ['name', 'twitter:title', title],
    ['name', 'twitter:description', description],
    ['name', 'twitter:image', socialImage],
  ];
  for (const [attribute, key, value] of tags) {
    const escapedKey = key.replace(':', '\\:');
    const pattern = new RegExp(`<meta\\s+${attribute}="${escapedKey}"[^>]*>`);
    html = replaceOrInsert(
      html,
      pattern,
      `<meta ${attribute}="${key}" content="${value}" />`,
      '</head>',
    );
  }

  return html;
}

for (const page of pages) {
  if (page.path === '/') continue;
  const routeDir = path.join(outputDir, ...page.path.slice(1).split('/'));
  await mkdir(routeDir, { recursive: true });
  await writeFile(path.join(routeDir, 'index.html'), htmlForPage(page), 'utf8');
}

// Keep the root document's metadata in sync with the shared route registry.
const homePage = pages.find(({ path: routePath }) => routePath === '/');
if (!homePage) throw new Error('SEO route registry is missing the homepage.');
await writeFile(path.join(outputDir, 'index.html'), htmlForPage(homePage), 'utf8');

// Vite copies public/404.html to dist/404.html; fail clearly if that stops happening.
await copyFile(path.join(root, 'public/404.html'), path.join(outputDir, '404.html'));
