# 过程脚本

## 本任务处理步骤

1. 核对 `package.json` 的 ISC 声明和仓库正文，没有「禁止再发布」条款。代码版权保留 gabriellji，图卡和 MP3 不改。
2. 源码里资源路径改成相对当前页面解析，避免 GitHub Pages 项目站的子路径把 `/assets` 指到域名根。
3. 触摸翻卡不再依赖鼠标移出；Train / Play 开关补全可读文字；平板横竖屏把 8 张图卡和开始按钮放进一屏。
4. 用 esbuild 把 `english-for-kids/src` 打进现有 `english-for-kids/dist/script.js`，不跑旧版 Webpack。
5. 在本机用子路径静态站做 Chrome 触摸模拟验收（不是真 iPad Safari）。

## 过程脚本

| 脚本 | 用途 | 运行命令 |
| --- | --- | --- |
| `ipad_pages_smoke.mjs` | 子路径下检查图卡、Train 发音与翻卡、Play 完整一轮、三档视口 | 先起静态服务，再跑下面的命令 |

```bash
mkdir -p /tmp/pages-root /tmp/pwtest
ln -sfn "$PWD/english-for-kids/dist" /tmp/pages-root/english-for-kids-app
python3 -m http.server 8765 --bind 127.0.0.1 --directory /tmp/pages-root
npm install --prefix /tmp/pwtest puppeteer-core@23.11.1
node py/ipad_pages_smoke.mjs
```

静态页地址是 `http://127.0.0.1:8765/english-for-kids-app/`。浏览器是本机 Google Chrome，视口 1180×820、820×1180、1024×768，带触摸。

打包命令（改了 `english-for-kids/src` 之后）：

```bash
cd english-for-kids && npm run build:pages
```

## py/output

| 文件 | 说明 |
| --- | --- |
| `ipad-pages-test-log.txt` | 三档视口的验收日志 |
| `ipad_*_home.png` / `ipad_*_train_flip.png` / `ipad_*_play.png` / `ipad_*_play_win.png` | 对应视口截图 |

正式截图、日志和 `dist.zip` 同时放在运行环境的 artifacts，不提交 `py/output/`。

## 维护记录

| 日期 | 摘要 |
| --- | --- |
| 2026-11-08 | 增加 Pages 子路径与 iPad 触摸/布局的验收脚本 |
