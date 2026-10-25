/**
 * 用 CDP 驱动无头 Edge 截图 / 交互 / 抓控制台报错。
 * 用法：
 *   node tools/shoot.mjs --url=file:///D:/Desgin/portfolio-neu/index.html --w=390 --h=1500 --out=shots/x.png
 *   可选：--full 整页  --mobile  --settle=800  --eval="js 代码"
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? "true"] : [a, "true"];
  })
);

const URL_ = args.url;
const W = Number(args.w || 1280);
const H = Number(args.h || 900);
const OUT = args.out;
const MOBILE = args.mobile === "true";
const FULL = args.full === "true";
const SETTLE = Number(args.settle || 900);
const EVAL_FILE = args.evalFile;
const EVAL = EVAL_FILE ? fs.readFileSync(EVAL_FILE, "utf8") : (args.eval || "");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9400 + Math.floor(Math.random() * 400);
const PROFILE = path.join(os.tmpdir(), "cdp-shot-" + PORT);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitPort(timeout = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return await r.json();
    } catch {}
    await sleep(120);
  }
  throw new Error("devtools port not ready");
}

const chrome = spawn(
  EDGE,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--force-device-scale-factor=1",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    "about:blank",
  ],
  { stdio: "ignore" }
);

const cleanup = () => {
  try { chrome.kill(); } catch {}
  try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch {}
};

try {
  await waitPort();
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const target = list.find((t) => t.type === "page");
  if (!target) throw new Error("no page target");

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  const errors = [];

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
      return;
    }
    if (msg.method) {
      if (msg.method === "Runtime.exceptionThrown") {
        errors.push("EXC: " + (msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text));
      }
      if (msg.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(msg.params.type)) {
        errors.push(msg.params.type.toUpperCase() + ": " + msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(" "));
      }
      if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
        errors.push("LOG: " + msg.params.entry.text + " " + (msg.params.entry.url || ""));
      }
      const arr = listeners.get(msg.method);
      if (arr?.length) arr.shift()(msg.params);
    }
  };

  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const mid = ++id;
      pending.set(mid, { res, rej });
      ws.send(JSON.stringify({ id: mid, method, params }));
    });

  const once = (method, timeout = 15000) =>
    new Promise((res, rej) => {
      const arr = listeners.get(method) || [];
      arr.push(res);
      listeners.set(method, arr);
      setTimeout(() => rej(new Error("timeout " + method)), timeout);
    });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: W, height: H, deviceScaleFactor: 1, mobile: MOBILE,
  });

  const loaded = once("Page.loadEventFired");
  await send("Page.navigate", { url: URL_ });
  await loaded;
  await sleep(SETTLE);

  if (EVAL) {
    const r = await send("Runtime.evaluate", { expression: EVAL, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) errors.push("EVAL: " + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    else if (r.result?.value !== undefined) console.log("eval =>", JSON.stringify(r.result.value));
    await sleep(500);
  }

  const shot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: FULL,
    ...(FULL ? { clip: await (async () => {
      const m = await send("Page.getLayoutMetrics");
      const cs = m.cssContentSize || m.contentSize;
      return { x: 0, y: 0, width: W, height: Math.ceil(cs.height), scale: 1 };
    })() } : {}),
  });

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, Buffer.from(shot.data, "base64"));

  const info = await send("Runtime.evaluate", {
    expression: `JSON.stringify({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,sh:document.documentElement.scrollHeight,imgs:[...document.images].filter(i=>!i.complete||i.naturalWidth===0).length,cards:document.querySelectorAll('.card').length})`,
    returnByValue: true,
  });
  console.log("page =>", info.result.value);
  console.log("saved =>", OUT, fs.statSync(OUT).size, "bytes");

  if (errors.length) {
    console.log("CONSOLE ISSUES (" + errors.length + "):");
    errors.slice(0, 20).forEach((e) => console.log("  " + e));
  } else {
    console.log("CONSOLE: clean");
  }

  ws.close();
} catch (e) {
  console.error("FAILED:", e.message);
  process.exitCode = 1;
} finally {
  cleanup();
}
