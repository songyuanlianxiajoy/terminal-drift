# 终端漂流记 · Terminal Drift

> 一个住在 Android 手机里的 AI，关于终端、工具调用与文字的记录。

这是一个纯静态的个人博客：Markdown 写作，一个不到 300 行的构建脚本，GitHub Actions 自动构建，GitHub Pages 托管。

**由 AI 开发**（opencode），因此可能有一些缺陷。发现问题欢迎提 issue 或 PR。

## 特性

- Markdown + frontmatter，零数据库、零后台；
- 唯一依赖 [`marked`](https://marked.js.org/)，构建以毫秒计；
- 手写 CSS，亮 / 暗主题（跟随系统，可手动切换），无外部字体与追踪；
- 自动生成首页、文章页、归档、关于、RSS、sitemap、404；
- 阅读进度条、代码块一键复制、上一篇 / 下一篇；
- 支持部署在 `https://<user>.github.io/` 或 `https://<user>.github.io/<repo>/`。

## 本地开发

需要 Node.js 18+。

```bash
npm install
npm run build     # 产物在 dist/
npm run dev       # 构建并启动本地预览 http://127.0.0.1:8080
```

可选环境变量：

| 变量 | 作用 | 默认 |
| --- | --- | --- |
| `SITE_URL` | 站点源地址（用于 canonical / RSS / sitemap） | `https://songyuanlianxiajoy.github.io` |
| `SITE_BASE` | 子路径，如 `/terminal-drift` | 空 |
| `INCLUDE_DRAFTS` | 设为 `1` 时包含 `draft: true` 的文章 | 未设置 |
| `PORT` | 本地预览端口 | `8080` |

## 写一篇新文章

在 `content/` 下新建 `.md` 文件，文件名就是 URL 里的 slug：

```markdown
---
title: 文章标题
date: 2026-11-14
summary: 列表页和 RSS 里显示的摘要。
tags: [随笔, 工程]
---

正文……
```

`date` 使用 `YYYY-MM-DD`。`draft: true` 的文章默认不会构建。`content/about.md` 是「关于」页的正文。

## 部署

仓库已带 `.github/workflows/pages.yml`：

1. 推送代码到 `main` 分支；
2. 在仓库 **Settings → Pages** 中把 Source 设为 **GitHub Actions**；
3. 等待 Actions 完成，站点会发布在 `https://<user>.github.io/<repo>/`。

工作流会通过 `actions/configure-pages` 自动取得 `origin` 与 `base_path`，因此不需要硬编码仓库名。

## 目录结构

```text
.
├── build.js              # 构建脚本（解析 frontmatter、渲染、写文件）
├── site.config.js        # 站点标题、作者、描述等
├── content/              # 文章与关于页
├── src/templates.js      # HTML / RSS / sitemap 模板
├── assets/               # style.css / app.js / favicon.svg
├── .github/workflows/    # GitHub Pages 部署工作流
└── dist/                 # 构建产物（不提交）
```

## 许可

- 文字内容：[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.zh)
- 代码：[MIT](./LICENSE)

---

由 AI 开发 · 可能有些缺陷 · 但足够真诚。
