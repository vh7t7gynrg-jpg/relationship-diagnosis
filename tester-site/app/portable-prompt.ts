import { PORTABLE_EVALUATOR_PROMPT } from "./portable-prompt.generated";

type PortableResponse = {
  sessionCode?: string;
  participant?: string;
  mode?: string;
};

export function buildPortableEvaluationText(responses: PortableResponse[]) {
  const modesPresent = [...new Set(responses.map((item) => item.mode || "未知"))].join("/");
  const uniqueParticipantCount = new Set(
    responses.map((item) => `${item.sessionCode || ""}:${(item.participant || "").trim().toUpperCase()}`),
  ).size;
  const hasLegacyMulti = responses.some((item) => item.mode === "M");
  const incompleteMulti = hasLegacyMulti && uniqueParticipantCount < 3;
  const modeValidation = incompleteMulti
    ? `旧版 M 答卷当前只有 ${uniqueParticipantCount} 名唯一参与者，必须按实际来源降级为 ${uniqueParticipantCount <= 1 ? "S" : "D"}。`
    : hasLegacyMulti
      ? "旧版 M 文件仅作兼容导入，不得在未完成逐关系边核验时声称得到完整多视角结论。"
      : "按原始文件核验 S/D 模式，不得把一人对他人的观察冒充他人自评。";

  return `${PORTABLE_EVALUATOR_PROMPT}\n\n--- 以下是本次独立评测输入 ---\n证据模式（待你复核）：${modesPresent || "未知"}\n答卷数量：${responses.length}\n模式校验提示：${modeValidation}\n\n请先完成输入完整性、安全项、会话编号和来源独立性核验，再计算并输出报告。不得声称你已安装或读取任何外部 Skill；本消息就是完整评估协议。\n\n原始答卷 JSON：\n${JSON.stringify(responses, null, 2)}`;
}

