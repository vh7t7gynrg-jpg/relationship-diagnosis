import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the relationship evidence lab", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>关系评测实验室<\/title>/);
  assert.match(html, /单视角/);
  assert.match(html, /双视角/);
  assert.doesNotMatch(html, /多视角/);
  assert.match(html, /仅在本机处理/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("keeps quick, full, and legacy questionnaire contracts", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const domainBlock = page.slice(page.indexOf("const domains"), page.indexOf("const affectionSelfItems"));
  const contextBlock = page.slice(page.indexOf("const contextQuestions"), page.indexOf("function functioningIndex"));
  const affectionSelfBlock = page.slice(page.indexOf("const affectionSelfItems"), page.indexOf("const affectionSignalItems"));
  const affectionSignalBlock = page.slice(page.indexOf("const affectionSignalItems"), page.indexOf("const changeReadinessDomainIds"));
  assert.equal((domainBlock.match(/\{ id:/g) ?? []).length, 40);
  assert.equal((domainBlock.match(/core: true/g) ?? []).length, 20);
  assert.equal((contextBlock.match(/\{ id:/g) ?? []).length, 24);
  assert.equal((contextBlock.match(/core: true/g) ?? []).length, 10);
  assert.equal((affectionSelfBlock.match(/\{ id:/g) ?? []).length, 10);
  assert.equal((affectionSelfBlock.match(/core: true/g) ?? []).length, 6);
  assert.equal((affectionSignalBlock.match(/\{ id:/g) ?? []).length, 10);
  assert.equal((affectionSignalBlock.match(/core: true/g) ?? []).length, 6);
  assert.match(page, /relationship-evidence-v1/);
  assert.match(page, /relationship-evidence-v2/);
  assert.match(page, /incidentAttribution/);
  assert.match(page, /patternTrend/);
  assert.match(page, /context-bank-24-v1/);
  assert.match(page, /behavior-bank-40-v2\.1/);
  assert.match(page, /affection-bank-v1/);
  assert.match(page, /本人感情倾向/);
  assert.match(page, /本人继续意愿/);
  assert.match(page, /共同调整能力/);
  assert.match(page, /buildPortableEvaluationText/);
  assert.match(page, /无需安装/);
  assert.match(page, /选择获得结果的方式/);
  assert.match(page, /使用完整提示词/);
  assert.match(page, /安装并使用 Skill/);
  assert.match(page, /SKILL_REPOSITORY_URL/);
  assert.match(page, /不适用\/无观察机会/);
  assert.match(page, /function MirrorRatingRow/);
  assert.match(page, /visibleDomainGroups/);
  assert.match(page, /本人对自己的评价/);
  assert.match(page, /作答者观察，不是对方自评/);
  const modeBlock = page.slice(page.indexOf("const modes"), page.indexOf("const domains"));
  assert.doesNotMatch(modeBlock, /id: "M"/);
  assert.match(page, /旧版 M 仅兼容导入/);
});

test("builds a self-contained portable evaluator prompt", async () => {
  const generated = await readFile(new URL("../app/portable-prompt.generated.ts", import.meta.url), "utf8");
  const builder = await readFile(new URL("../app/portable-prompt.ts", import.meta.url), "utf8");
  assert.match(generated, /证据完整度/);
  assert.match(generated, /关系功能指数/);
  assert.match(generated, /问题机制比重/);
  assert.match(generated, /可证伪预测/);
  assert.match(generated, /最终结论/);
  assert.match(builder, /本消息就是完整评估协议/);
  assert.match(builder, /原始答卷 JSON/);
});

test("does not turn no-opportunity answers into zero scores", async () => {
  const { calculateFunctioningIndex } = await import(new URL("../app/scoring.ts", import.meta.url));
  const expected = [{ id: "negative", positive: false }, { id: "positive", positive: true }, { id: "unknown", positive: true }];
  assert.deepEqual(calculateFunctioningIndex({ negative: "0", positive: "N", unknown: "U" }, expected), { score: 100, coverage: 33 });
  assert.deepEqual(calculateFunctioningIndex({ positive: "0" }, [{ id: "positive", positive: true }]), { score: 0, coverage: 100 });
});
