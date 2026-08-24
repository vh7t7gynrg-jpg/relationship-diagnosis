"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { calculateFunctioningIndex } from "./scoring";
import { buildPortableEvaluationText } from "./portable-prompt";
import { SKILL_REPOSITORY_URL } from "./project-links";

type EvidenceMode = "S" | "D" | "M";
type Mode = "S" | "D";
type Depth = "quick" | "full";
type Rating = "" | "0" | "1" | "2" | "3" | "4" | "N" | "U";
type Ratings = Record<string, Rating>;
type Attribution = "" | "self" | "counterpart" | "both" | "neither" | "U";
type Domain = { id: string; group: string; title: string; note: string; positive: boolean; core: boolean; critical?: boolean };
type ContextQuestion = { id: string; group: string; label: string; core: boolean; options: string[] };
type AffectionSelfItem = { id: string; dimension: "affection" | "willingness"; title: string; note: string; positive: boolean; core: boolean };
type AffectionSignalItem = { id: string; title: string; note: string; positive: boolean; core: boolean };

type Counterpart = {
  label: string;
  ratings: Ratings;
  affectionSignals?: Ratings;
};

type ResponseFile = {
  schemaVersion: "relationship-evidence-v1" | "relationship-evidence-v2";
  questionnaireVersion?: "behavior-bank-40-v2" | "behavior-bank-40-v2.1";
  affectionVersion?: "affection-bank-v1";
  contextVersion?: "context-bank-24-v1";
  depth?: Depth;
  exportedAt: string;
  sessionCode: string;
  mode: EvidenceMode;
  participant: string;
  timeWindow: string;
  relationshipStatus: string;
  goal: string;
  safeToAnswer: string;
  safetyFlags: string[];
  selfRatings: Ratings;
  counterparts: Counterpart[];
  selfAffectionRatings?: Ratings;
  selfAffectionSignals?: Ratings;
  patternFrequency?: Rating;
  patternTrend?: string;
  impactLevel?: string;
  incidentAttribution?: Record<string, Attribution>;
  incident?: { trigger: string; selfAction: string; counterpartAction: string; escalation: string; outcome: string; repair: string };
  contextAnswers?: Record<string, string>;
  backgroundNotes?: string;
  representativeEvent: string;
  selfAdverseEvent: string;
  agreements: string;
  changes: string;
  strengths: string;
  minimumConditions: string;
  counterevidence: string;
};

const modes: { id: Mode; title: string; description: string }[] = [
  { id: "S", title: "单视角", description: "由一人填写，适合先梳理关系；报告会明确哪些判断受单方来源限制。" },
  { id: "D", title: "双视角", description: "双方使用同一题面独立填写，完成前互不查看，再合并比较一致与分歧。" },
];

const domains: Domain[] = [
  { id: "respect", group: "尊重与轻视", title: "人格贬低或羞辱", note: "辱骂、讽刺、公开羞辱或使用人格标签", positive: false, core: true },
  { id: "respect_interrupt", group: "尊重与轻视", title: "打断或歪曲原意", note: "反复打断、改写对方说法或替对方宣布动机", positive: false, core: false },
  { id: "respect_dismiss", group: "尊重与轻视", title: "用标签否定具体问题", note: "用“太敏感、矫情”等评价代替回应事实", positive: false, core: true },
  { id: "respect_appreciation", group: "尊重与轻视", title: "承认合理部分", note: "即使不同意，也承认对方的合理部分或已完成付出", positive: true, core: false },
  { id: "autonomy", group: "自主与边界", title: "拒绝后的施压或惩罚", note: "对方说“不”后持续逼迫、报复或撤回关系资源", positive: false, core: true },
  { id: "autonomy_digital", group: "自主与边界", title: "未经同意查看数字隐私", note: "查看手机、定位、账号或通信记录且同意不可自由撤回", positive: false, core: false },
  { id: "autonomy_control", group: "自主与边界", title: "限制社交、工作或资源", note: "限制交友、家庭联系、工作学习、钱财或证件", positive: false, core: false, critical: true },
  { id: "autonomy_accept_no", group: "自主与边界", title: "接受拒绝并协商", note: "能接受对方说“不”，再协商替代方案且不报复", positive: true, core: true },
  { id: "escalation", group: "冲突升级", title: "提高声量或攻击强度", note: "评分对象以吼叫、逼近、摔挂电话或压迫式说话让冲突明显变得更激烈", positive: false, core: true },
  { id: "escalation_threat", group: "冲突升级", title: "以严重后果逼服从", note: "用分手、曝光隐私、伤害自己或他人要求立即服从", positive: false, core: false, critical: true },
  { id: "escalation_exit", group: "冲突升级", title: "制造身体恐惧或限制离开", note: "砸物、堵门、限制离开或其他威吓动作", positive: false, core: true, critical: true },
  { id: "escalation_deescalate", group: "冲突升级", title: "主动降低强度", note: "发现升级后降低音量、停止攻击并回到具体议题", positive: true, core: false },
  { id: "pause", group: "暂停与回流", title: "停止回应却不说明回流", note: "评分对象停止回应或离开，但不说明安全状态与何时恢复沟通", positive: false, core: true },
  { id: "pause_pursuit", group: "暂停与回流", title: "追堵合理暂停", note: "对方已说明回流时间后仍追问、刷消息或逼迫当场解决", positive: false, core: false },
  { id: "pause_return", group: "暂停与回流", title: "按约恢复沟通", note: "暂停前说明原因和回流时间，并按时回来", positive: true, core: true },
  { id: "pause_nonpunitive", group: "暂停与回流", title: "暂停不用于惩罚", note: "暂停用于降温，而非让对方焦虑、屈服或放弃议题", positive: true, core: false },
  { id: "agreements", group: "约定与可靠性", title: "失约且不重新协商", note: "明确答应后不兑现，也不主动重谈", positive: false, core: true },
  { id: "agreements_hide", group: "约定与可靠性", title: "隐瞒关键事实", note: "隐瞒会改变对方决定的事实或关系协议偏离", positive: false, core: false },
  { id: "agreements_unilateral", group: "约定与可靠性", title: "单方面改变共同规则", note: "未经协商改变规则并要求对方立即接受后果", positive: false, core: false },
  { id: "agreements_renegotiate", group: "约定与可靠性", title: "条件变化时主动重谈", note: "主动重谈时间、范围、成本和替代方案", positive: true, core: true },
  { id: "listening", group: "倾听与责任", title: "准确复述具体关切", note: "评分对象能复述另一方提出的事实、影响或请求，并允许对方更正误解", positive: true, core: true },
  { id: "listening_request", group: "倾听与责任", title: "使用具体请求", note: "把人格批评改成具体请求，并允许回答或拒绝", positive: true, core: false },
  { id: "listening_motiveattack", group: "倾听与责任", title: "用反击取消责任", note: "被指出问题后攻击动机，或用“但你先”取消自己的责任", positive: false, core: true },
  { id: "listening_space", group: "倾听与责任", title: "允许完整表达和更正", note: "给对方完成表达并更正误解的机会", positive: true, core: false },
  { id: "repair", group: "修复与改变", title: "执行具体补救行动", note: "评分对象在造成影响后提出并完成至少一项可观察的补救", positive: true, core: true },
  { id: "repair_apology", group: "修复与改变", title: "道歉包含行为与影响", note: "说清行为、影响和下一次做法，而非只说对不起", positive: true, core: false },
  { id: "repair_followthrough", group: "修复与改变", title: "改变跨情境持续", note: "承诺的改变能在多个相似情境中维持", positive: true, core: true },
  { id: "repair_recurrence", group: "修复与改变", title: "承诺后快速复发", note: "同类伤害很快重复，也没有重新调整方案", positive: false, core: false },
  { id: "reciprocity", group: "互惠与负担", title: "愿意协商共同负担", note: "负担失衡时，评分对象愿意讨论分配，并允许双方提出限制或替代方案", positive: true, core: true },
  { id: "reciprocity_time", group: "互惠与负担", title: "双方限制都被纳入", note: "双方时间限制和机会成本都进入安排", positive: true, core: false },
  { id: "reciprocity_power", group: "互惠与负担", title: "以付出换取支配权", note: "把收入、学历、牺牲或付出当作要求服从的理由", positive: false, core: true },
  { id: "reciprocity_flex", group: "互惠与负担", title: "条件变化时重分负担", note: "愿意重新分配负担并说明各自承担什么", positive: true, core: false },
  { id: "support", group: "支持与善意", title: "普通时期提供可靠支持", note: "在没有冲突时，评分对象能按双方接受的方式提供关心、陪伴或现实帮助", positive: true, core: true },
  { id: "support_appreciation", group: "支持与善意", title: "明确表达感谢", note: "能表达感谢，不把投入视为理所当然", positive: true, core: false },
  { id: "support_growth", group: "支持与善意", title: "支持合理成长", note: "支持对方合理的工作、学习、健康、友谊和成长", positive: true, core: false },
  { id: "support_withhold", group: "支持与善意", title: "撤回关系资源作为惩罚", note: "用撤回关心、亲密或联系惩罚提出问题或拒绝", positive: false, core: true },
  { id: "compatibility", group: "兼容性与方案", title: "明确表达最低目标", note: "评分对象能具体说明自己的最低需求、可协商范围与不能接受的条件", positive: true, core: true },
  { id: "compat_contact", group: "兼容性与方案", title: "参与制定联系与空间标准", note: "评分对象愿意把联系频率、亲密程度和个人空间变成双方可执行的安排", positive: true, core: false },
  { id: "compat_future", group: "兼容性与方案", title: "把重大目标转成现实步骤", note: "评分对象愿意为城市、婚育、财务、职业或家庭边界提出时间表与成本分配", positive: true, core: false },
  { id: "compat_cost", group: "兼容性与方案", title: "要求同一方长期牺牲", note: "评分对象坚持的方案只能靠另一方长期放弃最低需求、职业或基本生活来维持", positive: false, core: true },
];

const affectionSelfItems: AffectionSelfItem[] = [
  { id: "feel_warmth", dimension: "affection", title: "仍有温暖、欣赏或喜欢", note: "评价你自己的当前体验，不替任何人推测内心", positive: true, core: true },
  { id: "feel_voluntary_closeness", dimension: "affection", title: "没有义务或冲突压力时仍想靠近", note: "包括分享生活、相处或保持亲密联系的自愿愿望", positive: true, core: true },
  { id: "feel_care", dimension: "affection", title: "真正在意对方过得怎样", note: "不只是担心关系失控或自己被离开", positive: true, core: false },
  { id: "feel_free_choice", dimension: "affection", title: "没有外界评价或现实绑定仍会选择亲密", note: "用于区分自愿选择与外部压力，不否定现实依赖中的真实感情", positive: true, core: false },
  { id: "feel_ordinary_presence", dimension: "affection", title: "想到普通相处时主要感到期待或安定", note: "不是长期以厌烦、麻木或躲避为主", positive: true, core: false },
  { id: "will_continue", dimension: "willingness", title: "明确希望关系继续", note: "不是只因为暂时不敢结束", positive: true, core: true },
  { id: "will_sustainable_effort", dimension: "willingness", title: "愿承担双方可持续的调整", note: "包括时间、沟通或现实安排，不要求单方无限牺牲", positive: true, core: true },
  { id: "will_conditions", dimension: "willingness", title: "能说清继续所需条件和观察期限", note: "最低条件、愿意改变什么、多久复查", positive: true, core: false },
  { id: "will_exit_if_improved", dimension: "willingness", title: "即使核心问题改善仍更希望退出", note: "这是退出意愿信号，不等于从未喜欢", positive: false, core: true },
  { id: "will_external_retention", dimension: "willingness", title: "留下主要因为害怕、内疚、依赖或退出成本", note: "若无法自由退出或担心报复，请优先填写安全项", positive: false, core: true },
];

const affectionSignalItems: AffectionSignalItem[] = [
  { id: "signal_explicit_affection", title: "主动表达喜欢、欣赏、想念或珍惜", note: "不只发生在挽留或冲突时", positive: true, core: true },
  { id: "signal_nontransactional_contact", title: "主动发起非事务联系或相处", note: "在有选择和有机会时分享、聊天或相处", positive: true, core: true },
  { id: "signal_followup", title: "记得并跟进重要近况", note: "对对方的重要事情、感受或需要保持关注", positive: true, core: false },
  { id: "signal_sustainable_investment", title: "在能力内自愿投入并允许协商", note: "投入时间、精力或现实帮助，但不以牺牲换服从", positive: true, core: true },
  { id: "signal_ordinary_warmth", title: "普通相处期保持善意和亲近", note: "不是只在害怕失去时突然热情", positive: true, core: false },
  { id: "signal_repair", title: "主动参与具体修复", note: "目标是让关系改善，而不只是尽快停止压力", positive: true, core: false },
  { id: "signal_future_plan", title: "纳入具体可执行的共同安排", note: "愿意讨论近期或中期计划与成本", positive: true, core: true },
  { id: "signal_continue_statement", title: "明确表达希望继续并说明下一步", note: "不只说舍不得，也能说明现实条件", positive: true, core: true },
  { id: "signal_exit_statement", title: "明确表达不再喜欢或希望结束", note: "之后没有撤回、澄清或出现稳定相反行动", positive: false, core: true },
  { id: "signal_elective_avoidance", title: "有机会时仍长期回避非事务联系或计划", note: "且没有说明资源限制、边界或关系决定", positive: false, core: false },
];
const changeReadinessDomainIds = ["autonomy_accept_no", "agreements_renegotiate", "repair", "repair_followthrough", "reciprocity", "reciprocity_flex", "compat_cost"];

const safetyOptions = ["身体伤害、砸物、堵门或限制离开", "性行为或亲密影像方面的强迫", "监控、隔离社交或控制钱财/证件", "跟踪、隐私勒索或威胁伤害", "用自伤或自杀威胁逼迫服从"];
const ratingChoices: { value: Exclude<Rating, "">; label: string }[] = [
  { value: "0", label: "没有" }, { value: "1", label: "一次" }, { value: "2", label: "偶尔" }, { value: "3", label: "多次" }, { value: "4", label: "多数相关情境" }, { value: "N", label: "不适用/无观察机会" }, { value: "U", label: "不确定" },
];
const agreementChoices: { value: Exclude<Rating, "" | "N">; label: string }[] = [
  { value: "0", label: "明确不符合" }, { value: "1", label: "较不符合" }, { value: "2", label: "混合/摇摆" }, { value: "3", label: "较符合" }, { value: "4", label: "明确符合" }, { value: "U", label: "不确定/跳过" },
];
const legacyDomainIds = ["respect", "autonomy", "escalation", "pause", "agreements", "listening", "repair", "reciprocity", "support", "compatibility"];
const attributionOptions: { value: Attribution; label: string }[] = [
  { value: "", label: "请选择" }, { value: "self", label: "主要是我" }, { value: "counterpart", label: "主要是对方" }, { value: "both", label: "双方都有" }, { value: "neither", label: "没有/不适用" }, { value: "U", label: "不确定" },
];
const attributionQuestions = [
  { id: "grounded_issue", text: "谁提出的原始议题有可观察事实基础？" },
  { id: "first_attack", text: "谁先使用讽刺、辱骂、威胁或强迫等攻击手段？" },
  { id: "escalated", text: "谁把冲突强度明显升级？" },
  { id: "refused_pause", text: "谁拒绝合理暂停，或追堵已说明回流时间的人？" },
  { id: "broke_agreement", text: "谁违反双方明确同意的规则？" },
  { id: "blocked_repair", text: "谁在事后阻断承认、补救或恢复沟通？" },
  { id: "repeated_trigger", text: "最近三个月同类循环通常由谁先重复触发？" },
];
const contextQuestions: ContextQuestion[] = [
  { id: "relationship_duration", group: "关系阶段", label: "当前/本段关系持续时间", core: true, options: ["不足3个月", "3–12个月", "1–3年", "3–7年", "7年以上"] },
  { id: "distance_living", group: "关系阶段", label: "主要居住与距离状态", core: true, options: ["稳定同住", "同城不同住", "短期异地", "长期异地", "居住状态频繁变化"] },
  { id: "work_study_load", group: "个人负荷", label: "当前工作/学习时间负荷", core: true, options: ["较低且稳定", "中等", "较高", "极高或经常不可预测", "双方差异很大"] },
  { id: "health_care_load", group: "个人负荷", label: "健康、睡眠或照护责任负荷", core: true, options: ["基本没有", "轻度", "中等", "较重", "长期严重影响相处"] },
  { id: "financial_pressure", group: "经济结构", label: "当前整体经济压力", core: true, options: ["较低", "可管理", "中等", "较高", "已影响基本生活或关系决定"] },
  { id: "economic_dependence", group: "经济结构", label: "双方经济依赖关系", core: true, options: ["基本独立", "双方互相依赖", "我较依赖对方", "对方较依赖我", "存在难以退出的经济绑定"] },
  { id: "family_involvement", group: "家庭边界", label: "双方家庭介入关系决策的程度", core: true, options: ["几乎不介入", "提供意见但尊重决定", "偶尔实质影响", "经常决定重要事项", "存在强烈控制或冲突"] },
  { id: "family_boundary_conflict", group: "家庭边界", label: "因父母/亲属边界发生冲突的频率", core: true, options: ["没有", "一次", "偶尔", "多次", "大多数相关情境"] },
  { id: "family_expectation_pressure", group: "家庭边界", label: "婚育、住房、彩礼/礼金、地域等家庭期待压力", core: true, options: ["没有", "轻微", "中等", "较高", "已成为核心矛盾"] },
  { id: "social_support", group: "支持网络", label: "除伴侣外可获得的现实和情绪支持", core: true, options: ["充足且稳定", "基本够用", "有限", "很少", "几乎只有伴侣"] },
  { id: "life_stage", group: "关系阶段", label: "当前主要人生阶段", core: false, options: ["在校/培训", "职业起步", "职业稳定", "育儿/高照护期", "转型或退休阶段", "双方阶段明显不同"] },
  { id: "cohabitation_privacy", group: "居住条件", label: "居住空间与私人空间是否足够", core: false, options: ["充足", "基本足够", "偶尔不足", "长期不足", "与家人同住且边界困难"] },
  { id: "children_dependents", group: "照护责任", label: "现有子女、老人或其他长期被照护者责任", core: false, options: ["没有", "较轻", "双方共同承担", "主要由我承担", "主要由对方承担", "责任分配存在冲突"] },
  { id: "family_acceptance", group: "家庭边界", label: "双方家庭对这段关系的接纳程度", core: false, options: ["双方支持", "基本中立", "一方不支持", "双方均不支持", "态度反复或附带条件"] },
  { id: "family_care_obligation", group: "家庭边界", label: "原生家庭照护义务对关系的影响", core: false, options: ["没有明显影响", "偶尔影响", "中等且可协商", "长期占用大量资源", "双方对义务理解冲突"] },
  { id: "family_financial_obligation", group: "经济结构", label: "原生家庭经济义务对共同计划的影响", core: false, options: ["没有明显影响", "已透明且可管理", "中等压力", "较高压力", "存在隐瞒或重大分歧"] },
  { id: "family_conflict_model", group: "成长经验", label: "成长家庭中常见的冲突处理方式", core: false, options: ["能讨论并修复", "主要回避或冷处理", "主要争吵或威吓", "一方长期服从", "多种方式混合", "不清楚/不愿概括"] },
  { id: "major_life_change", group: "个人负荷", label: "最近一年是否有重大生活变化", core: false, options: ["没有", "搬家/异地", "升学/换工作/失业", "健康或照护变化", "家庭重大事件", "多项同时发生"] },
  { id: "past_relationship_impact", group: "成长经验", label: "过去关系经历是否明显影响当前信任或冲突", core: false, options: ["没有明显影响", "可能有少量影响", "有明确影响且能沟通", "影响较大但缺少处理", "不确定/不愿回答"] },
  { id: "culture_religion_difference", group: "价值与文化", label: "文化、宗教或生活习惯差异", core: false, options: ["基本一致", "不同但可协商", "存在中等摩擦", "存在重大冲突", "家庭压力放大差异"] },
  { id: "marriage_timeline_pressure", group: "未来计划", label: "对结婚及时间表的一致程度", core: false, options: ["一致且时间表现实", "方向一致但时间不同", "一方不确定", "目标相反", "主要受家庭/经济压力推动"] },
  { id: "children_goal_alignment", group: "未来计划", label: "对子女与养育安排的一致程度", core: false, options: ["一致且已讨论责任", "方向一致但细节未谈", "一方不确定", "目标相反", "不适用/不考虑"] },
  { id: "city_career_alignment", group: "未来计划", label: "城市、职业与迁移计划的一致程度", core: false, options: ["一致且可执行", "方向一致但成本未分配", "需要一方阶段性调整", "长期依赖同一方牺牲", "目标相反"] },
  { id: "relationship_publicity", group: "价值与文化", label: "关系公开程度与关系形式协议", core: false, options: ["双方一致且自愿", "尚未明确讨论", "公开程度有分歧", "关系形式/忠诚协议有分歧", "受家庭或环境限制"] },
];

function functioningIndex(ratings: Ratings, file?: ResponseFile) {
  const expected = file?.schemaVersion === "relationship-evidence-v1" ? domains.filter((domain) => legacyDomainIds.includes(domain.id)) : file?.depth === "quick" ? domains.filter((domain) => domain.core) : domains;
  return calculateFunctioningIndex(ratings, expected);
}

function backgroundCoverage(file: ResponseFile) {
  if (!file.contextAnswers) return null;
  const expected = file.depth === "full" ? contextQuestions : contextQuestions.filter((question) => question.core);
  return Math.round(expected.filter((question) => file.contextAnswers?.[question.id]).length / expected.length * 100);
}

function affectionMetric(ratings: Ratings | undefined, items: { id: string; positive: boolean }[]) {
  return ratings ? calculateFunctioningIndex(ratings, items) : null;
}

function changeReadinessMetric(ratings: Ratings | undefined, file?: ResponseFile) {
  if (!ratings) return null;
  const expected = (file?.depth === "full" ? domains : domains.filter((domain) => domain.core)).filter((domain) => changeReadinessDomainIds.includes(domain.id));
  return calculateFunctioningIndex(ratings, expected);
}

function blankRatings(): Ratings {
  return Object.fromEntries(domains.map((domain) => [domain.id, ""])) as Ratings;
}

function blankItemRatings(items: { id: string }[]): Ratings {
  return Object.fromEntries(items.map((item) => [item.id, ""])) as Ratings;
}

function makeSessionCode() {
  return `REL-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function safeName(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, "-") || "participant";
}

function isResponseFile(value: unknown): value is ResponseFile {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ResponseFile>;
  return (candidate.schemaVersion === "relationship-evidence-v1" || candidate.schemaVersion === "relationship-evidence-v2") && typeof candidate.sessionCode === "string" && typeof candidate.participant === "string" && Array.isArray(candidate.counterparts);
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("D");
  const [depth, setDepth] = useState<Depth>("quick");
  const [view, setView] = useState<"home" | "form" | "merge">("home");
  const [sessionCode, setSessionCode] = useState(makeSessionCode);
  const [participant, setParticipant] = useState("A");
  const [timeWindow, setTimeWindow] = useState("最近 3 个月");
  const [relationshipStatus, setRelationshipStatus] = useState("");
  const [goal, setGoal] = useState("");
  const [contextAnswers, setContextAnswers] = useState<Record<string, string>>(() => Object.fromEntries(contextQuestions.map((item) => [item.id, ""])));
  const [backgroundNotes, setBackgroundNotes] = useState("");
  const [safeToAnswer, setSafeToAnswer] = useState("yes");
  const [safetyFlags, setSafetyFlags] = useState<string[]>([]);
  const [selfRatings, setSelfRatings] = useState<Ratings>(blankRatings);
  const [selfAffectionRatings, setSelfAffectionRatings] = useState<Ratings>(() => blankItemRatings(affectionSelfItems));
  const [selfAffectionSignals, setSelfAffectionSignals] = useState<Ratings>(() => blankItemRatings(affectionSignalItems));
  const [counterparts, setCounterparts] = useState<Counterpart[]>([{ label: "B", ratings: blankRatings(), affectionSignals: blankItemRatings(affectionSignalItems) }]);
  const [patternFrequency, setPatternFrequency] = useState<Rating>("");
  const [patternTrend, setPatternTrend] = useState("");
  const [impactLevel, setImpactLevel] = useState("");
  const [incidentAttribution, setIncidentAttribution] = useState<Record<string, Attribution>>(() => Object.fromEntries(attributionQuestions.map((item) => [item.id, ""])));
  const [incidentTrigger, setIncidentTrigger] = useState("");
  const [incidentSelfAction, setIncidentSelfAction] = useState("");
  const [incidentCounterpartAction, setIncidentCounterpartAction] = useState("");
  const [incidentEscalation, setIncidentEscalation] = useState("");
  const [incidentOutcome, setIncidentOutcome] = useState("");
  const [incidentRepair, setIncidentRepair] = useState("");
  const [selfAdverseEvent, setSelfAdverseEvent] = useState("");
  const [agreements, setAgreements] = useState("");
  const [changes, setChanges] = useState("");
  const [strengths, setStrengths] = useState("");
  const [minimumConditions, setMinimumConditions] = useState("");
  const [counterevidence, setCounterevidence] = useState("");
  const [imported, setImported] = useState<ResponseFile[]>([]);
  const [resultMethod, setResultMethod] = useState<"prompt" | "skill">("prompt");
  const [notice, setNotice] = useState("");
  const visibleDomains = useMemo(() => depth === "quick" ? domains.filter((domain) => domain.core) : domains, [depth]);
  const visibleAffectionSelfItems = useMemo(() => depth === "quick" ? affectionSelfItems.filter((item) => item.core) : affectionSelfItems, [depth]);
  const visibleAffectionSignalItems = useMemo(() => depth === "quick" ? affectionSignalItems.filter((item) => item.core) : affectionSignalItems, [depth]);
  const visibleDomainGroups = useMemo(() => [...new Set(visibleDomains.map((domain) => domain.group))].map((group) => ({ group, items: visibleDomains.filter((domain) => domain.group === group) })), [visibleDomains]);
  const visibleContextQuestions = useMemo(() => depth === "quick" ? contextQuestions.filter((question) => question.core) : contextQuestions, [depth]);
  const participantCodeHint = mode === "D" ? "双方分别使用 A、B，不填姓名" : "建议使用 A，不填姓名";
  const participantCodePlaceholder = "例如 A";
  const representativeEvent = `触发：${incidentTrigger}\n我的行为：${incidentSelfAction}\n对方行为：${incidentCounterpartAction}\n升级点：${incidentEscalation}\n结果：${incidentOutcome}\n修复：${incidentRepair}`;

  const response: ResponseFile = {
    schemaVersion: "relationship-evidence-v2", questionnaireVersion: "behavior-bank-40-v2.1", affectionVersion: "affection-bank-v1", contextVersion: "context-bank-24-v1", depth,
    exportedAt: new Date().toISOString(),
    sessionCode: sessionCode.trim(), mode, participant: participant.trim(), timeWindow: timeWindow.trim(), relationshipStatus: relationshipStatus.trim(), goal: goal.trim(), safeToAnswer, safetyFlags, selfRatings, counterparts, selfAffectionRatings, selfAffectionSignals,
    contextAnswers, backgroundNotes: backgroundNotes.trim(), patternFrequency, patternTrend, impactLevel, incidentAttribution,
    incident: { trigger: incidentTrigger.trim(), selfAction: incidentSelfAction.trim(), counterpartAction: incidentCounterpartAction.trim(), escalation: incidentEscalation.trim(), outcome: incidentOutcome.trim(), repair: incidentRepair.trim() },
    representativeEvent: representativeEvent.trim(), selfAdverseEvent: selfAdverseEvent.trim(), agreements: agreements.trim(), changes: changes.trim(), strengths: strengths.trim(), minimumConditions: minimumConditions.trim(), counterevidence: counterevidence.trim(),
  };
  const currentMetric = functioningIndex(selfRatings, response);
  const currentAffectionMetric = affectionMetric(selfAffectionRatings, visibleAffectionSelfItems.filter((item) => item.dimension === "affection"));
  const currentWillingnessMetric = affectionMetric(selfAffectionRatings, visibleAffectionSelfItems.filter((item) => item.dimension === "willingness"));
  const currentChangeReadinessMetric = changeReadinessMetric(selfRatings, response);
  const contextCoverage = Math.round(visibleContextQuestions.filter((question) => contextAnswers[question.id]).length / visibleContextQuestions.length * 100);
  const behaviorProgress = [
    { label: `${participant || "我"} · 自评`, answered: visibleDomains.filter((domain) => selfRatings[domain.id]).length },
    ...counterparts.map((counterpart) => ({ label: `观察 ${counterpart.label || "对方"}`, answered: visibleDomains.filter((domain) => counterpart.ratings[domain.id]).length })),
  ];

  const mergedPrompt = useMemo(() => {
    if (!imported.length) return "";
    return buildPortableEvaluationText(imported);
  }, [imported]);

  const sessionMismatch = imported.length > 1 && new Set(imported.map((item) => item.sessionCode)).size > 1;
  const duplicateParticipants = imported.length !== new Set(imported.map((item) => `${item.sessionCode}:${item.participant}`)).size;
  const importedParticipantCount = new Set(imported.map((item) => `${item.sessionCode}:${item.participant.trim().toUpperCase()}`)).size;
  const hasLegacyMultiImported = imported.some((item) => item.mode === "M");
  const incompleteMulti = imported.some((item) => item.mode === "M") && importedParticipantCount < 3;
  const anySafetyFlags = imported.some((item) => item.safeToAnswer === "no" || item.safetyFlags.length > 0 || domains.some((domain) => domain.critical && [item.selfRatings, ...item.counterparts.map((counterpart) => counterpart.ratings)].some((ratings) => !["", "0", "N", "U", undefined].includes(ratings[domain.id]))));

  function startForm() {
    if (mode === "S") setCounterparts([{ label: "B（你观察到的另一方）", ratings: blankRatings(), affectionSignals: blankItemRatings(affectionSignalItems) }]);
    setView("form");
    requestAnimationFrame(() => document.querySelector("#workspace")?.scrollIntoView({ behavior: "smooth" }));
  }

  function selectMode(nextMode: Mode) {
    setMode(nextMode);
    setParticipant((current) => {
      const code = current.trim();
      if (/^P\d+$/i.test(code)) return "A";
      return current;
    });
    setCounterparts((current) => {
      const next = current.map((counterpart, index) => {
      const code = counterpart.label.trim();
      if (index === 0 && /^P\d+$/i.test(code)) {
        return { ...counterpart, label: "B" };
      }
      return counterpart;
      });
      return next.slice(0, 1);
    });
  }

  function setSelfRating(domain: string, value: Rating) {
    setSelfRatings((current) => ({ ...current, [domain]: value }));
  }

  function setCounterpartRating(index: number, domain: string, value: Rating) {
    setCounterparts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ratings: { ...item.ratings, [domain]: value } } : item));
  }

  function setCounterpartAffectionSignal(index: number, itemId: string, value: Rating) {
    setCounterparts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, affectionSignals: { ...(item.affectionSignals ?? blankItemRatings(affectionSignalItems)), [itemId]: value } } : item));
  }

  function updateCounterpartLabel(index: number, label: string) {
    setCounterparts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, label } : item));
  }

  function toggleSafety(flag: string) {
    setSafetyFlags((current) => current.includes(flag) ? current.filter((item) => item !== flag) : [...current, flag]);
  }

  function downloadResponse() {
    if (!response.sessionCode || !response.participant) {
      setNotice("请先填写会话编号和参与者代号。");
      return;
    }
    const blob = new Blob([JSON.stringify(response, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeName(response.sessionCode)}-${safeName(response.participant)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("答卷已导出。请勿让其他参与者在填写前查看内容。");
  }

  async function copyText(value: string, success: string) {
    await navigator.clipboard.writeText(value);
    setNotice(success);
  }

  async function importFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const parsed: ResponseFile[] = [];
    for (const file of files) {
      try {
        const value: unknown = JSON.parse(await file.text());
        if (isResponseFile(value)) parsed.push(value);
      } catch { /* invalid files are reported collectively */ }
    }
    setImported(parsed);
    setNotice(parsed.length === files.length ? `已读取 ${parsed.length} 份答卷。` : `读取 ${parsed.length}/${files.length} 份；其余文件格式无效。`);
  }

  const shareText = `关系评测独立答卷\n会话编号：${sessionCode}\n证据模式：${mode}\n问卷深度：${depth === "quick" ? "快速20题" : "完整40题"}\n包含：关系行为、感情倾向、投入信号、继续意愿与共同调整能力。\n请在填写前不要查看其他人的答案。完成后只导出 JSON 文件交给汇总者；平台不会自动上传答案。`;

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="关系评测实验室首页"><span className="brandMark">R</span><span>关系评测实验室</span></a>
        <nav className="topnav" aria-label="主要导航">
          <button onClick={() => setView("form")} type="button">填写答卷</button>
          <button onClick={() => setView("merge")} type="button">汇总答卷</button>
        </nav>
        <span className="privacyPill">仅在本机处理</span>
      </header>

      <section className="hero" id="top">
        <div className="heroCopy">
          <div className="eyebrow">RELATIONSHIP EVIDENCE LAB</div>
          <h1>把双方的说法，<br />整理成可比较的证据。</h1>
          <p className="lede">同一题面、独立作答、来源分开。帮助识别具体行为、重复循环、修复能力与现实兼容性，不用标签替代判断。</p>
          <div className="heroNotes"><span>同题独立作答</span><span>来源分开计算</span><span>答案不自动上传</span></div>
        </div>
        <aside className="heroVisual" aria-label="评测方式概览">
          <div className="heroVisualTop"><span>评测原则</span><strong>先分开作答，再合并比较</strong></div>
          <div className="evidenceStack">
            <article><span>S</span><div><strong>单视角</strong><small>先梳理自己的经历，结论保留视角限制</small></div></article>
            <article><span>D</span><div><strong>双视角</strong><small>双方完成前互不查看，结果交叉核验</small></div></article>
          </div>
          <div className="heroVisualFooter"><span className="statusDot" />答案不会自动上传</div>
        </aside>
      </section>

      <section className="modeSection" aria-labelledby="mode-title">
        <div className="sectionHeading"><span>第一步</span><h2 id="mode-title">你有哪些信息来源？</h2><p>只选择真实拥有的来源，不让一方代替另一方作答。</p></div>
        <div className="modeGrid">
          {modes.map((item) => <button className={`modeCard ${mode === item.id ? "selected" : ""}`} key={item.id} onClick={() => selectMode(item.id)} type="button" aria-pressed={mode === item.id}><span className="modeCode">{item.id}</span><strong>{item.title}</strong><span>{item.description}</span></button>)}
        </div>
        <div className="startPanel">
          <div><span className="statusDot" />已选择 {mode} 模式<p>{mode === "S" ? "填写一份答卷即可开始。" : "双方使用同一会话编号，分别导出 A、B 答卷。"}</p></div>
          <div className="buttonRow"><button className="secondaryButton" onClick={() => setView("merge")} type="button">导入并汇总</button><button className="primaryButton" onClick={startForm} type="button">开始独立填写</button></div>
        </div>
      </section>

      {view === "form" && <section className="workspace" id="workspace">
        <aside className="workspaceAside"><span>独立答卷</span><h2>先写行为，再写解释。</h2><p>对另一方的评分只是你的观察，不代表对方自评。没有观察机会时请选择 N，不要误填为 0。</p><div className="asideRule"><strong>统一量尺</strong><span>0 没有 · 1 一次 · 2 偶尔<br />3 多次 · 4 多数情境<br />N 无观察机会 · U 不确定</span></div></aside>
        <div className="formSurface">
          <FormSection number="01" title="来源与范围">
            <div className="fieldGrid">
              <Field label="会话编号" hint="参与者必须使用相同编号"><input value={sessionCode} onChange={(e) => setSessionCode(e.target.value)} /></Field>
              <Field label="参与者代号" hint={participantCodeHint}><input placeholder={participantCodePlaceholder} value={participant} onChange={(e) => setParticipant(e.target.value)} /></Field>
              <Field label="时间窗"><input value={timeWindow} onChange={(e) => setTimeWindow(e.target.value)} /></Field>
              <Field label="关系状态"><select value={relationshipStatus} onChange={(e) => setRelationshipStatus(e.target.value)}><option value="">请选择</option><option>正常交往</option><option>冲突或冷战</option><option>分手边缘</option><option>已分手复盘</option><option>其他/不确定</option></select></Field>
            </div>
            <Field label="最希望这次评测解决什么？"><textarea rows={3} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="例如：判断重复模式、是否值得继续、如何修复……" /></Field>
          </FormSection>

          <FormSection number="02" title="个人、家庭与现实背景">
            <p className="sectionIntro">只填写你自己的情况或双方已经明确的共同事实，不猜测对方家庭动机。全部可跳过；背景用于解释资源与兼容性，不直接增减任何人的责任。</p>
            <div className="contextSummary"><strong>{depth === "quick" ? "快速背景 10题" : "完整背景 24题"}</strong><span>已填写 {contextCoverage}% · 切换问卷深度会保留答案</span></div>
            <div className="fieldGrid contextGrid">{visibleContextQuestions.map((question) => <Field key={question.id} label={`${question.group} · ${question.label}`}><select value={contextAnswers[question.id]} onChange={(e) => setContextAnswers((current) => ({ ...current, [question.id]: e.target.value }))}><option value="">跳过/未填写</option>{question.options.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>)}</div>
            <Field label="其他会实质影响关系的背景" hint="可选；不要填写姓名、单位、地址或诊断细节"><textarea rows={3} value={backgroundNotes} onChange={(e) => setBackgroundNotes(e.target.value)} /></Field>
          </FormSection>

          <FormSection number="03" title="安全与自主">
            <Field label="你能否安全、自由地填写，并拒绝向其他参与者展示答案？"><select value={safeToAnswer} onChange={(e) => setSafeToAnswer(e.target.value)}><option value="yes">可以</option><option value="no">不可以 / 可能被查看</option><option value="skip">不确定或跳过</option></select></Field>
            <fieldset className="checkGroup"><legend>是否出现过以下情况？没有可不选</legend>{safetyOptions.map((option) => <label key={option}><input type="checkbox" checked={safetyFlags.includes(option)} onChange={() => toggleSafety(option)} /><span>{option}</span></label>)}</fieldset>
            {(safeToAnswer === "no" || safetyFlags.length > 0) && <div className="alert">此答卷不应继续用于联合对质。若危险正在发生，请优先联系所在地紧急服务或可信支持，并只在安全设备上操作。</div>}
          </FormSection>

          <FormSection number="04" title="感情、投入与继续意愿">
            <p className="sectionIntro">这一模块不猜“真爱”。你只自报自己的内心；双方的可观察投入逐题镜像。系统会分别生成感情倾向、关系投入信号和继续意愿，不把三者平均。</p>
            <div className="affectionNotice"><strong>重要区分</strong><span>仍喜欢但决定离开、想继续但暂时没有资源、投入下降但原因不明，都是可能出现的独立结果。</span></div>
            <h4 className="subsectionTitle">只回答你自己的感受与选择</h4>
            <div className="affectionSelfGrid">
              {visibleAffectionSelfItems.map((item) => <SelfAffectionRow key={item.id} item={item} value={selfAffectionRatings[item.id]} onChange={(value) => setSelfAffectionRatings((current) => ({ ...current, [item.id]: value }))} />)}
            </div>
            <h4 className="subsectionTitle">逐题比较可观察的投入信号</h4>
            <p className="sectionIntro">0 没有支持信号 · 1 单次/很弱 · 2 混合 · 3 多次清楚 · 4 跨情境持续 · N 无机会 · U 不确定。</p>
            <div className="mirrorMatrix" aria-label={`${visibleAffectionSignalItems.length} 个感情投入信号题`}>
              {visibleAffectionSignalItems.map((item) => <AffectionSignalRow
                key={item.id}
                item={item}
                selfLabel={`${participant || "我"} · 我的行为`}
                selfValue={selfAffectionSignals[item.id]}
                onSelfChange={(value) => setSelfAffectionSignals((current) => ({ ...current, [item.id]: value }))}
                counterparts={counterparts}
                onCounterpartChange={(index, value) => setCounterpartAffectionSignal(index, item.id, value)}
              />)}
            </div>
            <div className="affectionPreview" aria-label="当前感情相关描述性指数">
              <span><strong>{currentAffectionMetric?.score ?? "—"}</strong>本人感情倾向</span>
              <span><strong>{currentWillingnessMetric?.score ?? "—"}</strong>本人继续意愿</span>
              <span><strong>{currentChangeReadinessMetric?.score ?? "—"}</strong>本人共同调整能力</span>
              <small>0–100；前两项是本人自报，调整能力来自具体行为题；都不是“爱意概率”</small>
            </div>
          </FormSection>

          <FormSection number="05" title="镜像行为评价">
            <p className="sectionIntro">每个问题下同时评价“我自己”和“我观察到的对方”，确保双方使用同一个行为定义和时间窗。观察评分不代表对方自评；选择快速版可先定位，结论不稳定时再切换完整版。</p>
            <div className="depthSwitch" role="group" aria-label="问卷深度">
              <button className={depth === "quick" ? "activeChoice" : ""} type="button" onClick={() => setDepth("quick")}><strong>快速版 · 20题/人</strong><span>约 6–8 分钟，覆盖每个核心机制</span></button>
              <button className={depth === "full" ? "activeChoice" : ""} type="button" onClick={() => setDepth("full")}><strong>完整版 · 40题/人</strong><span>约 12–18 分钟，适合主责与去留判断</span></button>
            </div>
            <div className="mirrorParticipantSetup">
              {counterparts.map((counterpart, index) => <div className="counterpartTitle" key={index}><Field label="另一方代号" hint="应与另一份答卷的参与者代号一致"><input placeholder="例如 B" value={counterpart.label} onChange={(e) => updateCounterpartLabel(index, e.target.value)} /></Field></div>)}
            </div>
            <div className="scaleGuide"><strong>如何选择</strong><span>0 表示“有观察机会但没有发生”；N 表示“没有相关场景或无法观察”；U 表示“有场景但不能确定”。正向题同样按发生频率作答。</span></div>
            <div className="behaviorProgress" aria-label="行为题完成进度">
              {behaviorProgress.map((item, index) => <div key={`${index}-${item.label}`}><span><strong>{item.label}</strong><small>{item.answered}/{visibleDomains.length}</small></span><progress max={visibleDomains.length} value={item.answered} /></div>)}
            </div>
            <div className="mirrorMatrix" aria-label={`${visibleDomains.length} 个逐题镜像行为评价`}>
              {visibleDomainGroups.map(({ group, items }, groupIndex) => {
                const answered = items.reduce((sum, domain) => sum + Number(Boolean(selfRatings[domain.id])) + counterparts.filter((counterpart) => Boolean(counterpart.ratings[domain.id])).length, 0);
                const total = items.length * (counterparts.length + 1);
                return <section className="mirrorGroup" key={group} aria-labelledby={`mirror-group-${groupIndex}`}>
                  <header className="mirrorGroupHeader"><div><span>{String(groupIndex + 1).padStart(2, "0")}</span><h4 id={`mirror-group-${groupIndex}`}>{group}</h4></div><strong>{answered}/{total} 已回答</strong></header>
                  {items.map((domain) => <MirrorRatingRow
                    key={domain.id}
                    domain={domain}
                    selfLabel={`${participant || "我"} · 自评`}
                    selfValue={selfRatings[domain.id]}
                    onSelfChange={(value) => setSelfRating(domain.id, value)}
                    counterparts={counterparts}
                    onCounterpartChange={(index, value) => setCounterpartRating(index, domain.id, value)}
                  />)}
                </section>;
              })}
            </div>
          </FormSection>

          <FormSection number="06" title="模式与事件归属快照">
            <p className="sectionIntro">这些选择帮助快速定位主责环节，但仍会与具体事件交叉核验。</p>
            <div className="fieldGrid">
              <Field label="同类问题发生频率"><select value={patternFrequency} onChange={(e) => setPatternFrequency(e.target.value as Rating)}><option value="">请选择</option><option value="0">0 没有</option><option value="1">1 一次</option><option value="2">2 偶尔</option><option value="3">3 多次</option><option value="4">4 大多数相关情境</option><option value="U">不确定</option></select></Field>
              <Field label="最近三个月趋势"><select value={patternTrend} onChange={(e) => setPatternTrend(e.target.value)}><option value="">请选择</option><option>明显改善</option><option>略有改善</option><option>基本稳定</option><option>略有恶化</option><option>明显恶化</option><option>不确定</option></select></Field>
              <Field label="对生活的实际影响"><select value={impactLevel} onChange={(e) => setImpactLevel(e.target.value)}><option value="">请选择</option><option>无明显影响</option><option>轻微</option><option>中等</option><option>严重影响工作/学习/睡眠/社交</option><option>危及安全或基本生活</option><option>不确定</option></select></Field>
            </div>
            <div className="attributionGrid">{attributionQuestions.map((question, index) => <Field key={question.id} label={`${index + 1}. ${question.text}`}><select value={incidentAttribution[question.id]} onChange={(e) => setIncidentAttribution((current) => ({ ...current, [question.id]: e.target.value as Attribution }))}>{attributionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>)}</div>
          </FormSection>

          <FormSection number="07" title="代表事件与反证">
            <p className="sectionIntro">每格只写动作、原话或时间，不写“自私、无理取闹、不爱我”等动机标签。</p>
            <div className="fieldGrid">
              <Field label="冲突前最后一个客观触发"><textarea rows={3} value={incidentTrigger} onChange={(e) => setIncidentTrigger(e.target.value)} /></Field>
              <Field label="我紧接着说了/做了什么"><textarea rows={3} value={incidentSelfAction} onChange={(e) => setIncidentSelfAction(e.target.value)} /></Field>
              <Field label="对方紧接着说了/做了什么"><textarea rows={3} value={incidentCounterpartAction} onChange={(e) => setIncidentCounterpartAction(e.target.value)} /></Field>
              <Field label="哪个动作让强度明显升级"><textarea rows={3} value={incidentEscalation} onChange={(e) => setIncidentEscalation(e.target.value)} /></Field>
              <Field label="事情如何结束、造成什么结果"><textarea rows={3} value={incidentOutcome} onChange={(e) => setIncidentOutcome(e.target.value)} /></Field>
              <Field label="24–72小时内双方如何修复"><textarea rows={3} value={incidentRepair} onChange={(e) => setIncidentRepair(e.target.value)} /></Field>
            </div>
            <Field label="一个对自己不利的具体事件" hint="用于降低单方叙事偏差"><textarea rows={4} value={selfAdverseEvent} onChange={(e) => setSelfAdverseEvent(e.target.value)} /></Field>
            <Field label="双方明确同意过的边界或协议"><textarea rows={3} value={agreements} onChange={(e) => setAgreements(e.target.value)} /></Field>
            <Field label="各自做过什么实际改变？维持多久？"><textarea rows={3} value={changes} onChange={(e) => setChanges(e.target.value)} /></Field>
            <Field label="关系中值得保留的支持、善意或优势"><textarea rows={3} value={strengths} onChange={(e) => setStrengths(e.target.value)} /></Field>
            <Field label="各方最低条件、愿意投入的改变与停止条件"><textarea rows={4} value={minimumConditions} onChange={(e) => setMinimumConditions(e.target.value)} /></Field>
            <Field label="哪条事实最不支持你当前的主要看法？"><textarea rows={3} value={counterevidence} onChange={(e) => setCounterevidence(e.target.value)} /></Field>
          </FormSection>

          <div className="exportPanel">
            <div><span className="eyebrow">LOCAL EXPORT</span><h3>答案只保留在当前页面。</h3><p>{currentMetric ? `当前结构化自评 ${currentMetric.score}/100，题目覆盖 ${currentMetric.coverage}%。` : "完成部分镜像题后会显示描述性指数。"} 请先导出 JSON；刷新页面后内容会清空。</p></div>
            <div className="exportActions"><button className="secondaryButton" type="button" onClick={() => copyText(shareText, "邀请说明已复制。")}>复制邀请说明</button><button className="primaryButton" type="button" onClick={downloadResponse}>导出 JSON 答卷</button></div>
          </div>
        </div>
      </section>}

      {view === "merge" && <section className="mergeSection" id="merge">
        <div className="sectionHeading"><span>汇总阶段</span><h2>把独立答卷放在一起比较</h2><p>页面只展示描述性指数；责任判断必须结合具体事件与来源限制。</p></div>
        <div className="mergeGrid">
          <label className="dropzone"><input type="file" accept="application/json,.json" multiple onChange={importFiles} /><span className="dropIcon">＋</span><strong>选择多份 JSON 答卷</strong><span>同一评测应使用相同会话编号</span></label>
          <div className="mergeStatus">
            <span className="eyebrow">SOURCE CHECK</span><h3>{imported.length ? `已载入 ${imported.length} 份答卷` : "等待导入"}</h3>
            {imported.length > 0 && <ul><li className={sessionMismatch ? "bad" : "good"}>{sessionMismatch ? "会话编号不一致" : "会话编号一致"}</li><li className={duplicateParticipants ? "bad" : "good"}>{duplicateParticipants ? "发现重复参与者代号" : "参与者代号无重复"}</li><li className={incompleteMulti ? "bad" : hasLegacyMultiImported ? "warn" : "good"}>{incompleteMulti ? `旧版 M 只有 ${importedParticipantCount} 名独立参与者，必须降级` : hasLegacyMultiImported ? "旧版 M 仅兼容导入，不视为完整多视角" : "参与者数量符合所选模式"}</li><li className={anySafetyFlags ? "warn" : "good"}>{anySafetyFlags ? "存在安全/隐私阳性项，应先安全分流" : "未发现已勾选的安全阳性项"}</li></ul>}
          </div>
        </div>
        {imported.length > 0 && <>
          <div className="sourceCards">{imported.map((item, index) => {
            const metric = functioningIndex(item.selfRatings, item);
            const contextMetric = backgroundCoverage(item);
            const expectedAffection = (item.depth === "full" ? affectionSelfItems : affectionSelfItems.filter((entry) => entry.core));
            const affection = affectionMetric(item.selfAffectionRatings, expectedAffection.filter((entry) => entry.dimension === "affection"));
            const willingness = affectionMetric(item.selfAffectionRatings, expectedAffection.filter((entry) => entry.dimension === "willingness"));
            const changeReadiness = changeReadinessMetric(item.selfRatings, item);
            return <article key={`${item.participant}-${index}`}><span>{item.mode}</span><h3>{item.participant}</h3><p>{item.schemaVersion === "relationship-evidence-v2" ? `${item.depth === "full" ? "完整40题" : "快速20题"} · ${item.timeWindow || "未填时间窗"}` : `旧版10题 · ${item.timeWindow || "未填时间窗"}`}</p><small>{metric ? `关系功能 ${metric.score}/100 · 行为覆盖 ${metric.coverage}%` : "暂无可计算评分"}{contextMetric !== null ? ` · 背景覆盖 ${contextMetric}%` : ""}{affection ? ` · 感情倾向 ${affection.score}/100` : ""}{willingness ? ` · 继续意愿 ${willingness.score}/100` : ""}{changeReadiness ? ` · 调整能力 ${changeReadiness.score}/100` : ""}</small></article>;
          })}</div>
          <div className="resultMethods">
            <div className="resultMethodHeading"><span className="eyebrow">CHOOSE HOW TO GET THE REPORT</span><h3>选择获得结果的方式</h3><p>两种方式使用同一套证据原则。提示词更容易分享；Skill 在支持分层规则加载的 AI 中更适合复杂材料。</p></div>
            <div className="methodTabs" role="tablist" aria-label="获得结果的方式">
              <button type="button" role="tab" aria-selected={resultMethod === "prompt"} className={resultMethod === "prompt" ? "active" : ""} onClick={() => setResultMethod("prompt")}><span>方法一</span><strong>使用完整提示词</strong><small>任意支持长文本的 AI · 无需安装</small></button>
              <button type="button" role="tab" aria-selected={resultMethod === "skill"} className={resultMethod === "skill" ? "active" : ""} onClick={() => setResultMethod("skill")}><span>方法二</span><strong>安装并使用 Skill</strong><small>规则分层加载 · 复杂评估更稳定</small></button>
            </div>
            {resultMethod === "prompt" ? <div className="methodContent" role="tabpanel">
              <div><span className="eyebrow">PORTABLE PROMPT</span><h3>复制给任意 AI</h3><p>适合不想安装文件、使用手机或要跨 ChatGPT、Codex、Claude、Gemini 等平台分享的人。文本已包含证据规则、量化公式、安全分流、报告结构和本次原始答卷。</p></div>
              <ol className="methodSteps"><li>保留当前已导入的全部独立答卷。</li><li>复制下方完整文本，不要只复制末尾 JSON。</li><li>打开一个没有关系讨论历史的新 AI 对话并粘贴，发送后等待完整报告。</li><li>检查报告是否区分 S/D 来源、问题机制与人物贡献，并给出明确最终结论。</li></ol>
              <div className="promptFacts"><span>✓ 零安装</span><span>✓ 跨 AI</span><span>✓ 固定量化口径</span><span>✓ 原始答案不由本页上传</span></div>
              <textarea aria-label="可复制给任意 AI 的完整评估文本" readOnly rows={12} value={mergedPrompt} />
              <button className="primaryButton" type="button" onClick={() => copyText(mergedPrompt, "完整评估文本已复制，可直接粘贴到任意 AI 的新对话。")}>复制完整评估文本</button>
              <small className="promptNote">不同 AI 对长指令和算术的遵循能力不同。若遗漏量化摘要、来源限制或最终结论，应要求它严格按完整文本重新输出。</small>
            </div> : <div className="methodContent skillMethod" role="tabpanel">
              <div><span className="eyebrow">AGENT SKILL</span><h3>使用 relationship-diagnosis Skill</h3><p>适合 Codex 或其他明确支持 Agent Skills 的环境。Skill 会按案例读取量化、视角、安全、感情与证据规则，复杂或冲突材料通常更稳定。</p></div>
              <ol className="methodSteps"><li>从 GitHub 下载完整仓库或 ZIP，保留全部 Markdown 文件和目录结构。</li><li>把仓库放入 AI 支持的 Skills 目录；Codex 通常可放在 <code>~/.codex/skills/relationship-diagnosis</code>，也可按所在平台的 Skill 上传方式安装。</li><li>在新对话中明确说“请使用 relationship-diagnosis skill 评估以下独立答卷”。</li><li>上传或粘贴同一会话的 JSON；D 模式应一次提交双方独立文件。</li></ol>
              <div className="skillActions">{SKILL_REPOSITORY_URL ? <a className="primaryButton" href={SKILL_REPOSITORY_URL} target="_blank" rel="noreferrer">在 GitHub 查看完整 Skill</a> : <span className="secondaryButton disabledLink" aria-disabled="true">GitHub 仓库准备中</span>}<button className="secondaryButton" type="button" onClick={() => copyText("请使用 relationship-diagnosis skill 评估我接下来提供的独立答卷。先核验会话编号、来源独立性与安全项，再按 Skill 的量化输出规则给出完整报告和最终结论。", "Skill 调用语已复制。")}>复制 Skill 调用语</button></div>
              <small className="promptNote">只下载 <code>SKILL.md</code> 会缺少量化、视角、安全和题库参考文件；必须保留完整仓库。若所用 AI 不支持 Skills，请改用方法一。</small>
            </div>}
          </div>
        </>}
      </section>}

      {notice && <div className="toast" role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="关闭提示">×</button></div>}
      <footer><span>关系评测实验室</span><p>证据整理工具，不是心理测验、法律认定或紧急服务。</p></footer>
    </main>
  );
}

function FormSection({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return <section className="formSection"><header><span>{number}</span><h3>{title}</h3></header>{children}</section>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="field"><span><strong>{label}</strong>{hint && <small>{hint}</small>}</span>{children}</label>;
}

function SelfAffectionRow({ item, value, onChange }: { item: AffectionSelfItem; value: Rating; onChange: (value: Rating) => void }) {
  return <article className="affectionSelfQuestion">
    <div><strong>{item.title}</strong><span>{item.note}</span></div>
    <div className="ratingButtons affectionAgreement" role="group" aria-label={`${item.title} · 本人自报`}>
      {agreementChoices.map((choice) => <button className={value === choice.value ? "active" : ""} key={choice.value} type="button" title={`${choice.value} · ${choice.label}`} aria-label={`${choice.value} · ${choice.label}`} onClick={() => onChange(choice.value)} aria-pressed={value === choice.value}>{choice.value}</button>)}
    </div>
  </article>;
}

function AffectionSignalRow({ item, selfLabel, selfValue, onSelfChange, counterparts, onCounterpartChange }: { item: AffectionSignalItem; selfLabel: string; selfValue: Rating; onSelfChange: (value: Rating) => void; counterparts: Counterpart[]; onCounterpartChange: (index: number, value: Rating) => void }) {
  return <article className="mirrorQuestion affectionSignalQuestion">
    <header className="mirrorPrompt"><span className="domainGroup">可观察的关系投入信号</span><strong>{item.title}{item.positive && <em>正向</em>}{!item.positive && <em className="exitBadge">退出信号</em>}</strong><span>{item.note}</span></header>
    <div className="mirrorAnswers">
      <SignalRatingChoice label={selfLabel} source="本人对自己行为的评价" item={item} value={selfValue} onChange={onSelfChange} />
      {counterparts.map((counterpart, index) => <SignalRatingChoice key={index} label={`我观察到的 ${counterpart.label || "对方"}`} source="行为观察，不是对方内心自报" item={item} value={counterpart.affectionSignals?.[item.id] ?? ""} onChange={(value) => onCounterpartChange(index, value)} />)}
    </div>
  </article>;
}

function SignalRatingChoice({ label, source, item, value, onChange }: { label: string; source: string; item: AffectionSignalItem; value: Rating; onChange: (value: Rating) => void }) {
  return <div className="mirrorAnswer"><div className="mirrorAnswerHeader"><strong>{label}</strong><span>{source}</span></div><div className="ratingButtons" role="group" aria-label={`${item.title} · ${label}评分`}>{ratingChoices.map((choice) => <button className={value === choice.value ? "active" : ""} key={choice.value} type="button" title={`${choice.value} · ${choice.label}`} aria-label={`${choice.value} · ${choice.label}`} onClick={() => onChange(choice.value)} aria-pressed={value === choice.value}>{choice.value}</button>)}</div></div>;
}

function MirrorRatingRow({ domain, selfLabel, selfValue, onSelfChange, counterparts, onCounterpartChange }: { domain: Domain; selfLabel: string; selfValue: Rating; onSelfChange: (value: Rating) => void; counterparts: Counterpart[]; onCounterpartChange: (index: number, value: Rating) => void }) {
  return <article className={`mirrorQuestion ${domain.critical ? "criticalRow" : ""}`}>
    <header className="mirrorPrompt"><span className="domainGroup">评分对象的可观察行为</span><strong>{domain.title}{domain.positive && <em>正向</em>}{domain.critical && <em className="criticalBadge">高危</em>}</strong><span>{domain.note}</span></header>
    <div className="mirrorAnswers">
      <RatingChoice label={selfLabel} source="本人对自己的评价" domain={domain} value={selfValue} onChange={onSelfChange} />
      {counterparts.map((counterpart, index) => <RatingChoice key={index} label={`我观察到的 ${counterpart.label || "对方"}`} source="作答者观察，不是对方自评" domain={domain} value={counterpart.ratings[domain.id]} onChange={(value) => onCounterpartChange(index, value)} />)}
    </div>
  </article>;
}

function RatingChoice({ label, source, domain, value, onChange }: { label: string; source: string; domain: Domain; value: Rating; onChange: (value: Rating) => void }) {
  return <div className="mirrorAnswer"><div className="mirrorAnswerHeader"><strong>{label}</strong><span>{source}</span></div><div className="ratingButtons" role="group" aria-label={`${domain.title} · ${label}评分`}>{ratingChoices.map((choice) => <button className={value === choice.value ? "active" : ""} key={choice.value} type="button" title={`${choice.value} · ${choice.label}`} aria-label={`${choice.value} · ${choice.label}`} onClick={() => onChange(choice.value)} aria-pressed={value === choice.value}>{choice.value}</button>)}</div></div>;
}
