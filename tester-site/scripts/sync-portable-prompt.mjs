import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(scriptDirectory, "../../standalone-prompt.md");
const outputPath = resolve(scriptDirectory, "../app/portable-prompt.generated.ts");

const markdown = await readFile(sourcePath, "utf8");
const match = markdown.match(/```text\s*\r?\n([\s\S]*?)\r?\n```/);

if (!match) {
  throw new Error("standalone-prompt.md must contain exactly one fenced text prompt");
}

const prompt = match[1].trim();
const requiredSections = ["安全优先", "证据完整度", "结构化关系功能指数", "问题机制比重", "可证伪预测", "最终结论"];
if (prompt.length < 2500 || requiredSections.some((section) => !prompt.includes(section))) {
  throw new Error("Portable evaluator prompt is unexpectedly short");
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `// Generated from ../../standalone-prompt.md. Do not edit directly.\nexport const PORTABLE_EVALUATOR_PROMPT = ${JSON.stringify(prompt)};\n`,
  "utf8",
);
