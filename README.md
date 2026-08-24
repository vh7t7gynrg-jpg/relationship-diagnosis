# relationship-diagnosis

用于评估恋爱冲突、关系健康度、分手贡献、修复可能性、感情与继续意愿、双方可改善行为及核心兼容性的 Agent Skill。

配套评测网页：<https://relationship-evidence-lab.pages.dev/>

网页可完成独立答卷、导出 JSON、合并同一会话的答卷，并生成可交给 AI 的评测材料。网页当前提供 `S` 单视角和 `D` 双视角两种答卷模式。

## 安装

### Codex

```bash
git clone https://github.com/vh7t7gynrg-jpg/relationship-diagnosis.git ~/.codex/skills/relationship-diagnosis
```

也可以下载仓库 ZIP，将解压后的完整 `relationship-diagnosis` 文件夹放入 Codex Skills 目录。不要只复制 `SKILL.md`，因为评估会按需要读取 `references/` 中的规则。

### 其他支持 Agent Skills 的 AI

下载完整仓库，按照对应平台的 Skill 导入或安装方式添加该文件夹。平台至少需要支持以 `SKILL.md` 为入口并读取相对路径资源。

## 使用

在新对话中直接说明要使用该 Skill，例如：

```text
请使用 relationship-diagnosis skill 评估以下关系答卷。
先核验证据模式、来源独立性和安全项，再给出量化摘要、问题机制比重、双方贡献、改善建议和最终结论。
```

也可以直接描述具体冲突：

```text
请使用 relationship-diagnosis skill 分析这次争吵。请区分事实、体验、解释和未知，并判断双方各自可改善的行为。
```

如平台支持显式 Skill 调用，也可使用：

```text
$relationship-diagnosis
```

然后粘贴事件描述或导出的 JSON 答卷。建议使用代号并删除姓名、账号、地址、单位和联系方式。

## 网页答卷模式

- `S`：单人、单视角答卷；可以评估具体行为，但不能冒充另一方观点。
- `D`：双方使用同一会话编号、题面和时间窗独立作答。

提交 D 答卷时，应一次提供双方 JSON，并确保参与者代号唯一、会话编号和时间窗一致。需要加入聊天记录等材料时，可以在 S 或 D 答卷之外补充已脱敏、上下文足够的记录。

## 输出内容

Skill 会根据材料完整度输出：

- 来源与安全核验；
- 描述性量化结果及证据完整度；
- 事实、体验、解释与未知；
- 问题机制比重和条件性人物贡献；
- 竞争解释、置信度及 2–4 周可证伪预测；
- 双方可改善行为、观察指标和停止条件；
- 明确的最终结论。

本 Skill 不是临床诊断、经过验证的心理量表、法律责任认定或紧急服务。出现暴力、性强迫、跟踪、限制自由、隐私勒索或报复风险时，应优先处理现实安全。

## 更新

```bash
cd ~/.codex/skills/relationship-diagnosis
git pull
```

许可证：[MIT](LICENSE)
