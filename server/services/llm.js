/**
 * DeepSeek LLM 服务
 * API 兼容 OpenAI 格式：https://api.deepseek.com/v1/chat/completions
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, "..", "config.json");

function getDeepseekConfig() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  const key = config.deepseek?.apiKey || process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DeepSeek API Key 未配置，请在 config.json 中设置 deepseek.apiKey");
  return {
    apiKey: key,
    model: config.deepseek?.model || "deepseek-chat",
    temperature: config.deepseek?.temperature ?? 0.3,
    maxTokens: config.deepseek?.maxTokens ?? 2000,
  };
}

const SYSTEM_PROMPT = `你是一位专业的加密货币市场分析师。请根据提供的新闻列表，生成一份简洁有力的市场分析报告。

要求：
1. 用中文输出
2. 严格输出以下 JSON 格式，不要包含任何其他文字：
{
  "summary": "2-3句话概括今日市场核心要点",
  "sentiment": "看多/看空/中性",
  "sentimentReason": "1句话说明理由",
  "opportunities": [
    { "title": "机会名称", "description": "简要说明", "riskLevel": "低/中/高" }
  ],
  "risks": ["风险点1", "风险点2"]
}

注意：
- opportunities 最多3个，选取最有价值的
- risks 最多3个
- 描述要具体，不要泛泛而谈
- 基于新闻内容分析，不要编造`;

/**
 * 调用 DeepSeek 分析新闻
 * @param {Array} newsItems - 新闻列表，每项含 title/cnTitle、summary、ccyList 等
 * @returns {Object} 结构化分析结果
 */
export async function analyzeNews(newsItems) {
  const { apiKey, model, temperature, maxTokens } = getDeepseekConfig();

  // 构建新闻摘要
  const newsText = newsItems.map((n, i) => {
    const title = n.cnTitle || n.title || "";
    const summary = (n.summary || "").slice(0, 200);
    const coins = (n.ccyList || []).join(", ");
    const sentiment = (n.ccySentiments || []).map(s => `${s.ccy}:${s.sentiment}`).join("; ");
    return `${i + 1}. [${coins || "综合"}] ${title}\n   ${summary}${sentiment ? `\n   情绪: ${sentiment}` : ""}`;
  }).join("\n\n");

  const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `请分析以下加密市场新闻：\n\n${newsText}` },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`DeepSeek API error ${resp.status}: ${errText.slice(0, 200)}`);
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || "";

  // 尝试解析 JSON（可能被 markdown code block 包裹）
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`DeepSeek 返回非 JSON: ${content.slice(0, 200)}`);

  const analysis = JSON.parse(jsonMatch[0]);
  return analysis;
}
