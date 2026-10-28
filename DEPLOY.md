# 作品集项目 · 运维与交接说明

> 这份文档记录了项目的真实状态、操作流程和待办事项。
> 换一个对话 / 换一台电脑接手时，先读这一份就够了。

---

## 一、当前线上地址

| 用途 | 地址 | 状态 |
|---|---|---|
| **作品集（给 HR 看）** | https://w2903705707-debug.github.io/portfolio/ | ✅ GitHub Pages，实时 |
| **后台（编辑内容）** | https://magenta-fudge-acb97a.netlify.app/admin/ | ✅ 可登录可发布 |
| 旧地址（同内容快照） | https://magenta-fudge-acb97a.netlify.app | ⚠️ Netlify 部署已暂停，停在旧快照 |
| 代码仓库 | https://github.com/w2903705707-debug/portfolio | 公开，约 510MB |

**为什么后台还在 Netlify**：Decap CMS 的 GitHub OAuth 回调注册在 Netlify 上，那边登录最稳。
Netlify 只是**停止部署**（免费额度用尽），网站和后台仍可正常访问。

---

## 二、架构（重要）

```
后台改内容 → 发布 → 写入 GitHub 仓库 content/*.json
                          ↓
              GitHub Pages 自动重建（1–2 分钟）
                          ↓
        前端 app.js 运行时 fetch content/*.json  → 页面更新
```

**关键点：网站不需要构建步骤。**
`app.js` 启动时直接请求：

```
content/site.json    站点设置（个人信息/分类/卡片/品牌/精选清单/工具链）
content/works.json   作品库（items 数组）
content/texts.json   页面文案（9 个分组）
```

请求带 `?v=时间戳`，所以内容永远是新的，不受浏览器缓存影响。

`data/content.js` 是旧的构建产物，现在只作为 `file://` 直接打开时的兜底，**不需要维护**。
`build.mjs` 仍可用于本地校验（`node build.mjs`），但线上已经不需要。

`index.html` 里资源引用带版本号（`app.js?v=20261027b`）。**改动 app.js / style.css 后，要把这个版本号改一下**，否则老访客可能继续用缓存的旧脚本，最多持续 10 分钟。

---

## 三、目录结构

```
D:\Desgin\portfolio-neu\
  index.html            单页结构（文字位置用 data-t="分组.键" 标记）
  style.css             全部样式，:root 下是主题变量
  app.js                全部逻辑（运行时加载 JSON、渲染、弹层、筛选）
  build.mjs             可选的校验/编译脚本
  content\
    site.json           站点设置
    works.json          作品库
    texts.json          页面文案
  data\content.js       旧构建产物（仅 file:// 兜底）
  assets\
    videos\wNN.mp4      作品视频（约 490MB，31 个）
    covers\wNN.jpg      封面（1280×720，按 16:9 居中裁切）
    favicon.svg
  admin\                Decap CMS（config.yml / theme.css / decap-cms.js）
  tools\                各种处理脚本，见第六节
  shots\                验证用截图（非线上资源）
  DEPLOY.md             本文件
```

---

## 四、日常操作

### 改文字 / 改联系方式 / 调顺序 / 藏作品

全部在后台完成：

1. 打开 https://magenta-fudge-acb97a.netlify.app/admin/
2. 左侧选 **站点设置** / **作品库** / **页面文案**
3. 改完点右上角 **发布 ▾ → 立即发布**（主按钮只展开菜单，必须点下拉里那项）
4. 等 1–2 分钟，刷新作品集网站

### 加一支新作品

1. 后台 → 作品库 → **添加一条**
2. 标题、分类、客户、年份、职责、时长、描述、标签
3. 「分类编号」不要动（`xcp / ae / short / aigc / mix` 靠它关联）
4. 有视频就填「本地 mp4 路径」`assets/videos/wNN.mp4` 或「B 站链接」
5. 发布

### 藏起一个位置（不删）

作品库 → 那条 → 勾 **隐藏这个作品位** → 发布。数据保留，随时能取消。

---

## 五、视频处理

### 硬性限制（实测）

| 通道 | 限制 |
|---|---|
| GitHub **网页上传** | 单文件 25MB |
| GitHub **API**（`push-files.mjs`） | 单文件约 **36MB**（62MB 就被拒 422） |
| **Git**（推荐） | 无实际限制（仓库总量 1GB 软上限） |
| Netlify 免费流量 | 100GB/月 |
| GitHub Pages | 软限制 100GB/月，单文件走仓库限制（100MB） |

### 当前编码参数（质量优先）

```bash
ffmpeg -y -i 源.mp4 \
  -vf "scale='if(gte(iw,ih),min(1920,iw),-2)':'if(gte(iw,ih),-2,min(1920,ih))':flags=lanczos,format=yuv420p" \
  -c:v libx264 -preset medium -profile:v high -level 4.1 -crf 20 \
  -movflags +faststart -c:a aac -b:a 160k -ac 2 \
  assets/videos/wNN.mp4
```

- `crf 20` 视觉近无损；重要长片可降到 18
- **不要为了码率牺牲清晰度**——源片信息量才是上限
- 竖屏保持竖屏，`app.js` 会自动识别并完整显示（不拉伸）

### 批量处理

```
node tools/encode-all.mjs     # 扫 D:\Desgin\video，按文件名映射到 wNN 自动编码
node tools/encode-pick.mjs    # 只重压指定的几支
```

`encode-all.mjs` 会跳过「输出比源新」的文件；**如果某次编码被中断，必须手动删掉那个残缺文件再重跑**（否则会被当成已完成）。
编码后务必校验：

```bash
ffprobe -v error -show_format assets/videos/wNN.mp4   # 报 moov atom not found 就是坏的
```

---

## 六、工具脚本（tools/）

| 脚本 | 作用 |
|---|---|
| `encode-all.mjs` | 批量编码 `D:\Desgin\video` 下全部源片 |
| `encode-pick.mjs` | 重压指定几支（列表写在脚本里） |
| `make-covers-from-video.py` | 每支抽 12 帧自动打分挑最佳，输出候选封面 |
| `make-cover-candidates.py` | 为指定作品生成 10 个候选帧对照图（人工挑） |
| `finalize-covers.py` | 按最终时间点生成 1280×720 封面；`MANUAL` 字典可覆盖自动挑选 |
| `locate-and-crop.py` | 用一张截图在视频里反查时间点（相似度匹配） |
| `push-files.mjs` | 用 GitHub API 推文件（单文件 ≤36MB 时可用） |
| `shoot.mjs` | 用 CDP 无头浏览器截图 / 执行页面 JS / 抓 console |

Python 脚本要设 `PYTHONIOENCODING=utf-8`，否则中文/符号会因 GBK 编码报错。

---

## 七、用 Git 推送（最可靠的方式）

```bash
# Git 在 D:\Git，需要先挂上系统代理（Astrill 的 127.0.0.1:3213）
git config --global http.proxy http://127.0.0.1:3213
git config --global https.proxy http://127.0.0.1:3213

# 克隆（只拉提交树，不下载视频，很快）
git clone --filter=blob:none --no-checkout --depth 1 \
  https://x-access-token:<TOKEN>@github.com/w2903705707-debug/portfolio.git repo-git
cd repo-git && git read-tree HEAD

# 改完文件后
mkdir -p 需要的目录        # --no-checkout 克隆没有工作文件，目录要自己建
cp <新文件> <目标路径>
git add <路径>
git -c user.name=x -c user.email=x@x commit -m "说明"
git push origin main
```

> **注意**：`repo-git` 是临时工作目录，remote 里内嵌了 token。
> 用完后请删除该目录，或执行 `git remote set-url origin https://github.com/w2903705707-debug/portfolio.git`。

---

## 八、已知限制与坑

1. **GitHub Pages 有缓存**：HTML/JS/CSS 约 10 分钟。改了 app.js 要同步改 `index.html` 里的 `?v=` 版本号。
2. **Netlify 免费额度**：2026-10 期间耗尽，`Production deploys are paused`。约每月 1 号重置。
3. **Git 默认不走 Windows 系统代理**：必须显式 `git config --global http.proxy`。
4. **会话 shell 里有 `HTTPS_PROXY=127.0.0.1:3213`**：Astrill 没开时 Node 会 `ECONNREFUSED`，临时用 `HTTPS_PROXY= NO_PROXY='*'` 绕过。
5. **API 推送大文件会 401**：连续大量上传后 GitHub 临时风控，过一会儿再试；>36MB 直接用 Git。
6. **编码中断会留残缺文件**：报 `moov atom not found`，必须删除重编。
7. **竖屏视频**：CSS 对竖屏用 `object-fit: contain`（完整显示 + 两侧黑边），横屏用 `cover`（填满）；判断逻辑在 `app.js` 的 `onloadedmetadata`。

---

## 九、待办（截至 2026-10-28）

| 事项 | 说明 |
|---|---|
| **w29 / w30 缺视频** | AI 古风修仙 ②③，把原片放进 `D:\Desgin\video` 后跑 `encode-all.mjs` |
| **B 站主页链接是占位** | 后台站点设置里还是 `000000000`，点了 404 |
| **w06 / w12 封面偏"文字卡"** | 可用 `make-cover-candidates.py` 重新挑帧 |
| **Netlify 老站点** | 另有一个带密码的旧站 `frolicking-sfogliatella-0616e1`，可删除 |
| **可选：迁到对象存储** | 想让长片跑 6–8Mbps 时用 R2（免费 10GB + 出网免费） |
| **可选：自定义域名** | `wangrongbing.com` 之类，比 github.io 专业 |

---

## 十、安全

- 用过的 GitHub token（`portfolio-video` / `portfolio-git` 等）用过即应在
  https://github.com/settings/tokens 删除。
- 若 `D:\Desgin\repo-git` 仍存在，其中 `.git/config` 内嵌了 token 明文，请删除或改写 remote。
- `D:\Desgin\proxy-backup-20261028.reg` 是改系统代理前的注册表备份，确认网络正常后可删。

---

## 十一、本地预览

```bash
cd D:\Desgin\portfolio-neu
python -m http.server 8099 --bind 127.0.0.1
# 浏览器打开 http://127.0.0.1:8099/index.html
```

直接双击 `index.html`（file://）也能看，但 `fetch` 会失败，此时走 `data/content.js` 兜底——
那个文件是旧的，内容可能过期。**本地看效果请用 http 服务器。**

---

## 十二、系统里留下的东西

| 位置 | 作用 |
|---|---|
| 计划任务 `DSH ProxyGuard Logon` / `Watch` | 每 5 分钟检查 Astrill 死代理并自动关闭（已改为 VBS 静默启动，不闪窗） |
| `C:\Users\Wrongbing1\AppData\Local\ProxyGuard\` | 上述任务的脚本（`proxy-guard.ps1` + `proxy-guard-hidden.vbs`） |
| `D:\Desgin\repo-git\` | 临时 Git 工作副本（含 token，用完可删） |
| `D:\Desgin\portfolio-video\` `portfolio-upload\` `portfolio-replace\` | 历次上传包，已过期，可删 |
| `D:\Desgin\hq-w01.mp4` `hq-w02.mp4` `hq-w13.mp4` `hq2\` | 高清版中间文件，已进仓库，可删 |
