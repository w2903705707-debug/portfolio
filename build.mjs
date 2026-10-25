/**
 * 构建脚本：content/*.json → data/content.js
 * 用法：node build.mjs
 * 后台（Decap CMS）保存后会由 Netlify 自动执行这一步。
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));

const site = readJson("content/site.json");
const worksFile = readJson("content/works.json");

const items = Array.isArray(worksFile.items) ? worksFile.items : [];
const catIds = new Set((site.categories || []).map((c) => c.id).filter(Boolean));

const errors = [];
const warns = [];
const seen = new Set();

items.forEach((w, i) => {
  const at = `第 ${i + 1} 个作品${w.title ? `「${w.title}」` : ""}`;
  if (!w.id) errors.push(`${at}：缺少 id`);
  if (w.id && seen.has(w.id)) errors.push(`${at}：id "${w.id}" 与前面的重复`);
  if (w.id) seen.add(w.id);
  if (!w.title) warns.push(`${at}：没有标题`);
  if (!w.cat) errors.push(`${at}：没有选分类`);
  else if (!catIds.has(w.cat)) errors.push(`${at}：分类 "${w.cat}" 不在分类表里`);
  if (w.bilibili && !/BV[0-9A-Za-z]{10}|^https?:\/\//.test(String(w.bilibili).trim())) {
    warns.push(`${at}：B 站字段看起来不是 BV 号也不是链接，可能无法播放`);
  }
});

if (errors.length) {
  console.error("✗ 构建失败，先修好这些再发布：");
  errors.forEach((e) => console.error("  - " + e));
  process.exit(1);
}

const visible = items.filter((w) => !w.hidden);
const payload = { site, works: items };
const out = `/* 自动生成，请勿手动修改。
   源文件：content/site.json + content/works.json（后台 /admin 编辑）
   重新生成：node build.mjs
   生成时间：${new Date().toISOString()} */
window.__CONTENT__ = ${JSON.stringify(payload, null, 2)};
`;

fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "data", "content.js"), out, "utf8");

console.log("✓ data/content.js 已生成");
console.log(
  `  作品 ${items.length} 个（显示 ${visible.length} / 隐藏 ${items.length - visible.length}）· 精选 ${visible.filter((w) => w.featured).length} 个`
);
const withBili = items.filter((w) => String(w.bilibili || "").trim()).length;
console.log(`  已填 B 站链接 ${withBili} 个，其余显示「视频待上传」`);

if (warns.length) {
  console.warn("\n提醒（不影响构建）：");
  warns.forEach((w) => console.warn("  - " + w));
}
