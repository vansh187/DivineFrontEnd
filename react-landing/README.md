# Divine Vision — Landing Page (React)

A static clone of the Divine Vision Infratech landing page (hero, corridor
journey, delivered-townships record, footer), rebuilt with React + Vite +
Tailwind CSS v4. No Three.js / WebGL — the scroll effects use GSAP
ScrollTrigger + Lenis smooth scroll only.

Colors, fonts (Merriweather + Open Sans via `@fontsource`), copy, and all
static assets (`/public/brand`, `/public/hero`, `/public/townships`) are
carried over exactly from the source Next.js project.

## Develop

```bash
npm install
npm run dev
```

## Build for production (static output)

```bash
npm run build
```

Output lands in `dist/` — plain static HTML/CSS/JS, ready to upload as-is.

## Deploy

Any static host works, since this is a client-only SPA with no server code:

- **Netlify / Vercel**: point the project at this folder, build command
  `npm run build`, publish directory `dist`.
- **GitHub Pages**: push the contents of `dist/` to a `gh-pages` branch (or
  use the `actions/deploy-pages` workflow).
- **Any static bucket** (S3, Cloudflare Pages, Firebase Hosting, etc.):
  upload the contents of `dist/` directly.

`npm run preview` serves the built `dist/` locally if you want to sanity
check the production build before deploying.
