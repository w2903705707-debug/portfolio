# 使用与维护说明

剪辑师作品集 · 纯静态站点 + 网页后台。内容在后台点选，保存后自动上线。

---

## 一、内容都放在哪

```
content/site.json    ← 个人信息、联系方式、Showreel、分类（含百分比）、工具链、
                       工作方式、合作方列表（可传 logo）、首页精选清单（有顺序）
content/works.json   ← 32 个作品（标题、分类、B 站链接、封面、隐藏开关、排序）
content/texts.json   ← 全站 56 条文案（各区块标题、说明、按钮文字、弹层标签）
```

这三个文件由**后台 `/admin`** 编辑，你也可以直接改 JSON。改完必须执行一次编译：

```bash
node build.mjs        # 生成 data/content.js（站点真正读的文件）
```

`build.mjs` 会做校验：id 重复、分类写错会直接报错并拒绝生成，不会把坏数据发上线。

---

## 二、三种使用场景

| 我想 | 怎么做 |
|---|---|
| 发给 HR 看 | 部署好之后，把 `https://你的站点.netlify.app` 发过去 |
| 改内容 | 打开 `https://你的站点.netlify.app/admin`，GitHub 登录，改完点保存 |
| 本地看效果 | `node build.mjs` 后双击 `index.html`，或 `python -m http.server` |

---

## 三、第一次搭起来（约 20 分钟，只需一次）

### 1. 把整个文件夹传到 GitHub

**推荐：网页上传（不用装任何东西）**

1. GitHub 新建仓库，名字 `portfolio`，**不要**勾 "Add a README file"
2. 仓库页面 → **Add file → Upload files**
3. 把 `portfolio-neu` 文件夹**里面的全部内容**拖进去（`index.html`、`app.js`、`style.css`、`build.mjs`、`netlify.toml`、`content/`、`data/`、`admin/`、`assets/`、`DEPLOY.md`）
   - ⚠️ 拖的是**文件夹里的东西**，不是文件夹本身，否则会多一层目录、站点打不开
   - 一次最多 100 个文件，本站共 43 个，够用
4. 底部写提交说明 → **Commit changes**

> `shots/`、`preview/`、`app.before-cms.js` 是本地开发产物，**不用上传**（`.gitignore` 里已排除）。

**如果你装了 Git，也可以走命令行：**

```bash
git remote add origin https://github.com/你的用户名/portfolio.git
git push -u origin main
```

### 2. Netlify 连这个仓库

1. <https://app.netlify.com/> → **Add new site → Import an existing project**
2. 选 **GitHub**，授权后选中你的 `portfolio` 仓库
3. 构建配置它会自动从 `netlify.toml` 读到：
   - Build command: `node build.mjs`
   - Publish directory: `.`
4. 点 **Deploy**

### 3. 打开后台登录（关键一步）

Decap CMS 需要 GitHub 授权，要在两处各配一次：

**a) GitHub 建 OAuth App**

GitHub → Settings → Developer settings → **OAuth Apps** → New OAuth App

| 字段 | 填什么 |
|---|---|
| Application name | 作品集后台 |
| Homepage URL | `https://你的站点.netlify.app` |
| Authorization callback URL | `https://api.netlify.com/auth/dialog/github/callback` |

注册后拿到 **Client ID**，再点 **Generate a new client secret** 拿到 **Client Secret**。

**b) Netlify 填入这对密钥**

Netlify → 你的站点 → **Site configuration → Access & security → OAuth**（不同版本可能叫 Access control / OAuth）→ Install provider → **GitHub** → 粘贴 Client ID 与 Client Secret → 保存。

**c) 改后台配置里的仓库名**

打开 `admin/config.yml`，把第一行的占位改掉：

```yaml
backend:
  name: github
  repo: 你的用户名/portfolio    # ← 改这里
  branch: main
```

提交这次改动，等 Netlify 重新部署完成。

### 4. 登录

访问 `https://你的站点.netlify.app/admin` → **Log in with GitHub** → 授权。

只有对该仓库有 push 权限的 GitHub 账号能进 —— 这就是「只有我能改」的实现方式，不是前端密码。

---

## 四、日常怎么改

全部在 `/admin` 里点，改完点右上角 **Publish**，Netlify 自动构建，几十秒后线上生效。

### 隐藏一个作品位（不是删除）

作品库 → 展开某条 → 勾上 **「隐藏这个作品位」** → Publish。

隐藏后：首页精选、全库卡片、分类计数、弹层左右翻页里都不再出现它。
**数据还在**，想恢复就取消勾选。

### 真的删掉

作品库 → 右上角那条作品 → 垃圾桶图标。删了就没了（可以靠 GitHub 历史找回）。

### 新增一个作品

作品库 → **Add 作品** → 填标题、选分类、填简介。

⚠️ **唯一编号**默认不要改（例如 `w01`），它和 `assets/covers/w01.jpg` 封面文件对应。新增时可以用 `w33`、`w34`。

### 调顺序

改每条作品的 **「排序」** 数字，越小越靠前（1 = 第一个）。Publish 后生效。

### 换封面

每条作品 → **封面图** → 上传，或留空自动用 `assets/covers/<编号>.jpg`。
上传的图会存进 `assets/covers/` 并被提交到仓库。

建议尺寸 1280×720（16:9），单张 200KB 以内。

### 填 B 站链接（让作品能播）

每条作品 → **「B 站链接或 BV 号」**：

| 填什么 | 效果 |
|---|---|
| `BV1xx411c7mD` | 详情弹层变成 B 站播放器 |
| `https://www.bilibili.com/video/BV1xx411c7mD` | 一样，会自动提取 BV 号 |
| 留空 | 显示「视频待上传」占位 |

填了 `本地 mp4 路径` 时，**B 站优先**。两者都空 = 占位。

> B 站那边视频要设为「公开」或「仅链接可见」，不能「仅自己可见」，否则 HR 看到的是黑屏。

### 改页面文案（区块标题与说明）

后台 → **页面文案** → 9 个折叠分组（导航 / 首屏 / 能力速览 / 精选 / 作品库 / 关于 / 联系 / 页脚 / 详情弹层）。

精选区说明里的「共 N 支」会自动填数字，你写 `{count}` 就行。

### 改「产出分布」的百分比

后台 → 站点设置 → **能力分类** → 每类有个「百分比 0-100」。

- 填了 → 进度条按你填的数字画，右侧显示百分比
- 留空 → 回到自动模式，按该类作品数量算
- 可以混用：只给重点类别填百分比，其余留空

### 改「合作与项目」的标签

后台 → 站点设置 → **合作与项目（手动维护）**：

| 字段 | 说明 |
|---|---|
| 名称 | 品牌名，必填 |
| Logo 图片 | 上传后显示图标；留空显示文字 |
| 链接 | 可选，点标签跳转 |
| 不显示这一项 | 勾上即隐藏，不删数据 |

**整个列表为空时**，会自动从所有作品的「客户」字段里提取品牌名（就是现在的表现）。

### 调「精选作品」的顺序

后台 → 站点设置 → **首页精选**：

- 每条是一个下拉框 + **上下箭头**，用箭头就能挪顺序
- 想换掉某一支，点下拉改选
- 想删就用垃圾桶；想加就点「Add」
- 清空整个列表 → 回落到每支作品的「放进首页精选」开关

> 下拉里的 32 个选项是 `build.mjs` 每次构建时自动写进 config 的，所以新增作品后选项会自动出现，你不用手动维护。

### 改个人信息 / 联系方式

站点设置 → 个人信息。改完 Publish，导航、Hero、页脚、联系区一起更新。

---

## 五、初始化生成的部分（一般不用动）

| 文件 | 作用 |
|---|---|
| `index.html` | 页面骨架 |
| `style.css` | 深色新拟态设计令牌与响应式 |
| `app.js` | 渲染逻辑（读 `data/content.js`） |
| `data/content.js` | **构建产物**，勿手改，由 `build.mjs` 生成 |
| `netlify.toml` | 构建命令、发布目录、后台不索引 |
| `build.mjs` | JSON → 站点数据的编译脚本 |
| `admin/` | Decap CMS 后台（只在 `/admin` 加载，公共页面不引用） |
| `admin/decap-cms.js` | CMS 脚本的**本地副本**（4.6MB）。这样后台不依赖 unpkg CDN，CDN 挂了也能进 |
| `admin/theme.css` | 后台主题：炭灰底 + 暖橙，与展示页同一套语言 |
| `assets/covers/` | 33 张封面（`w01..w32.jpg` + `reel.jpg`） |
| `tools/` | 占位封面生成、无头浏览器截图自测（开发用，可删） |

占位封面重新生成：

```bash
python tools/make-covers.py            # 电影感（深色站默认）
python tools/make-covers.py --morandi  # 低饱和莫兰迪
```

---

## 六、排查

**页面显示「内容还没生成」**
→ 忘了 `node build.mjs`，或者 Netlify 构建失败了（去 Deploys 看日志）。

**后台登录报错 `Failed to load config` / `404`**
→ `admin/config.yml` 里的 `repo` 还是占位 `YOUR_GITHUB_USERNAME/portfolio`。

**后台能登录，但保存后线上没变**
→ 看 Netlify Deploys：是不是构建失败了。构建失败时线上仍是上一版（不会挂）。

**某个作品不显示**
→ 检查它的「隐藏」是否被勾上；或分类 id 是否被改坏了（作品靠 `xcp/ae/short/aigc/mix` 关联分类）。

**视频不播**
→ 依次查：B 站视频是否公开、BV 号是否完整、是否开了「仅自己可见」。

---

## 七、三条不要碰的规则

1. **分类的「编号」不要改**（`xcp / ae / short / aigc / mix`）——作品靠它关联分类，改了会导致作品掉到「未分类」。
2. **`data/content.js` 不要手改**——它是构建产物，下次构建会被覆盖。要改内容请改 `content/*.json` 或走后台。
3. **`admin/config.yml` 里 `# >>> featured-options` 和 `# <<< featured-options` 之间的内容不要手改**——那是构建时按作品列表自动生成的精选下拉选项。
