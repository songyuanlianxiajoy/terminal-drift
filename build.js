import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

import { site } from "./site.config.js";
import {
  homePage,
  postPage,
  archivePage,
  aboutPage,
  notFoundPage,
  feedXml,
  sitemapXml,
} from "./src/templates.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.join(root, "content");
const assetsDir = path.join(root, "assets");
const outDir = path.join(root, "dist");

const BASE = (process.env.SITE_BASE || "").replace(/\/+$/, "");
const SITE_URL = (process.env.SITE_URL || "https://songyuanlianxiajoy.github.io").replace(/\/+$/, "");
const INCLUDE_DRAFTS = process.env.INCLUDE_DRAFTS === "1";

marked.use({
  gfm: true,
  breaks: false,
  renderer: {
    link(token) {
      const external = /^https?:\/\//i.test(token.href || "");
      const title = token.title ? ` title="${token.title}"` : "";
      const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : "";
      return `<a href="${token.href}"${title}${attrs}>${this.parser.parseInline(token.tokens)}</a>`;
    },
    image(token) {
      const title = token.title ? ` title="${token.title}"` : "";
      return `<img src="${token.href}" alt="${token.text || ""}"${title} loading="lazy" decoding="async">`;
    },
  },
});

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseFrontMatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (/^\[.*\]$/.test(value)) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((s) => stripQuotes(s.trim()))
        .filter(Boolean);
    } else if (key === "tags" && value.includes(",")) {
      value = value
        .split(",")
        .map((s) => stripQuotes(s.trim()))
        .filter(Boolean);
    } else if (value === "true" || value === "false") {
      value = value === "true";
    } else {
      value = stripQuotes(value);
    }
    data[key] = value;
  }
  return { data, body: match[2] };
}

function readingMinutes(text) {
  const cjk = (text.match(/[\u3400-\u9fff]/g) || []).length;
  const words = (text.replace(/[\u3400-\u9fff]/g, " ").match(/[A-Za-z0-9_'-]+/g) || []).length;
  return Math.max(1, Math.round(cjk / 350 + words / 220));
}

function loadPosts() {
  const files = fs.readdirSync(contentDir).filter((f) => f.endsWith(".md") && f !== "about.md");
  const posts = files.map((file) => {
    const raw = fs.readFileSync(path.join(contentDir, file), "utf8");
    const { data, body } = parseFrontMatter(raw);
    const slug = data.slug || file.replace(/\.md$/, "");
    if (!data.title) throw new Error(`文章 ${file} 缺少 title`);
    if (!data.date) throw new Error(`文章 ${file} 缺少 date`);
    if (data.draft && !INCLUDE_DRAFTS) return null;
    return {
      slug,
      title: data.title,
      date: data.date,
      summary: data.summary || "",
      tags: Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : [],
      minutes: readingMinutes(body),
      html: marked.parse(body),
    };
  });
  return posts.filter(Boolean).sort((a, b) => (a.date < b.date ? 1 : -1));
}

function write(relative, contents) {
  const target = path.join(outDir, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

function copyAssets() {
  for (const name of fs.readdirSync(assetsDir)) {
    const src = path.join(assetsDir, name);
    if (!fs.statSync(src).isFile()) continue;
    fs.copyFileSync(src, path.join(outDir, "assets", name));
  }
}

function build() {
  const started = Date.now();
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, "assets"), { recursive: true });

  const posts = loadPosts();
  if (posts.length === 0) throw new Error("content/ 里没有文章");
  const siteUrl = SITE_URL;

  write("index.html", homePage({ posts, base: BASE, siteUrl }));
  write("archive/index.html", archivePage({ posts, base: BASE, siteUrl }));

  const aboutRaw = fs.readFileSync(path.join(contentDir, "about.md"), "utf8");
  const about = parseFrontMatter(aboutRaw);
  write(
    "about/index.html",
    aboutPage({ html: marked.parse(about.body), base: BASE, siteUrl })
  );

  posts.forEach((post, i) => {
    const prev = posts[i + 1] || null;
    const next = posts[i - 1] || null;
    write(
      `posts/${post.slug}/index.html`,
      postPage({ post, prev, next, base: BASE, siteUrl })
    );
  });

  write("feed.xml", feedXml({ posts, base: BASE, siteUrl }));
  write(
    "sitemap.xml",
    sitemapXml({
      pages: ["/", "/archive/", "/about/", ...posts.map((p) => `/posts/${p.slug}/`)],
      base: BASE,
      siteUrl,
    })
  );
  write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`);
  write("404.html", notFoundPage({ base: BASE, siteUrl }));
  write(".nojekyll", "");
  copyAssets();

  const ms = Date.now() - started;
  console.log(`✓ 构建完成：${posts.length} 篇文章 → dist/（${ms} ms，base="${BASE || "/"}"）`);
  return posts;
}

function serve() {
  const port = Number(process.env.PORT || 8080);
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
    ".svg": "image/svg+xml",
    ".txt": "text/plain; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".woff2": "font/woff2",
  };
  http
    .createServer((req, res) => {
      const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      let file = path.join(outDir, urlPath);
      if (!file.startsWith(outDir)) {
        res.writeHead(403).end("forbidden");
        return;
      }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
      if (!fs.existsSync(file)) {
        file = path.join(outDir, "404.html");
        res.statusCode = 404;
      }
      res.setHeader("content-type", types[path.extname(file)] || "application/octet-stream");
      fs.createReadStream(file).pipe(res);
    })
    .listen(port, () => {
      console.log(`本地预览：http://127.0.0.1:${port}/`);
      console.log("改动后重新运行 npm run build 即可刷新（或另开终端再跑一次）");
    });
}

build();
if (process.argv.includes("--serve")) serve();
