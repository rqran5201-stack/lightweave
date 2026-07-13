/**
 * LLM API client — OpenAI-compatible.
 * Free models route through the Cloudflare Worker proxy; custom models go direct.
 */

import { isFreeModel, migrateModel } from './models';

const DEFAULT_PROXY_URL = 'https://lightweave-proxy.lightweave.workers.dev/v1';

function getApiBase() {
  const model = getModel();
  if (isFreeModel(model)) {
    const proxyUrl = localStorage.getItem('llm_proxy_url') || DEFAULT_PROXY_URL;
    return proxyUrl.replace(/\/+$/, '');
  }
  return localStorage.getItem('llm_api_base') || 'https://api.deepseek.com/v1';
}

function getApiKey() {
  if (isFreeModel(getModel())) return '';
  return localStorage.getItem('llm_api_key')
    || localStorage.getItem('deepseek_api_key')
    || import.meta.env.VITE_DEEPSEEK_API_KEY
    || '';
}

function getModel() {
  const raw = localStorage.getItem('llm_model') || '@cf/qwen/qwen3-30b-a3b-fp8';
  const migrated = migrateModel(raw);
  if (migrated !== raw) {
    localStorage.setItem('llm_model', migrated);
  }
  return migrated;
}

function getHeaders() {
  if (isFreeModel(getModel())) {
    return { 'Content-Type': 'application/json' };
  }
  const key = getApiKey();
  if (!key) throw new Error('API Key 未配置。请在设置中配置。');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${key}`,
  };
}

/**
 * Call DeepSeek chat API.
 */
export async function chatCompletion({ messages, model, temperature = 0.7, maxTokens = 2048, stream = false }) {
  const res = await fetch(`${getApiBase()}/chat/completions`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      model: model || getModel(),
      messages,
      temperature,
      max_tokens: maxTokens,
      stream,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('API Key 无效，请在设置中重新配置');
    throw new Error(err.error?.message || `API 请求失败 (${res.status})`);
  }

  return res.json();
}

/**
 * Stream chat completion.
 */
export async function* streamChatCompletion({ messages, model, temperature = 0.7, maxTokens = 2048 }) {
  const res = await fetch(`${getApiBase()}/chat/completions`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      model: model || getModel(),
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('API Key 无效');
    throw new Error(err.error?.message || `API 请求失败 (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Handle "data: {...}" or "data:{...}" (with or without space)
      let data;
      if (trimmed.startsWith('data: ')) {
        data = trimmed.slice(6);
      } else if (trimmed.startsWith('data:')) {
        data = trimmed.slice(5);
      } else {
        continue;
      }

      if (data === '[DONE]') return;
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch { /* skip malformed chunks */ }
    }
  }
}

/**
 * Analyze a new record against all historical records to find associations.
 * This is the core engine② — internal pattern association.
 */
export async function analyzeAssociations(newRecord, historicalRecords) {
  if (historicalRecords.length === 0) return { associations: [], externalKnowledge: null };

  const historicalSummaries = historicalRecords
    .slice(0, 30)
    .map(r => `[${r.id.slice(0, 8)}] ${new Date(r.createdAt).toLocaleDateString('zh-CN')}: ${r.content.slice(0, 200)}`)
    .join('\n---\n');

  const systemPrompt = `你是织光 LightWeave 的 AI 认知引擎。你的任务是在用户的记录之间发现深层关联——不只是语义相似，而是认知模式、情绪脉络、矛盾或成长轨迹上的关联。

分析原则：
1. 不只是找"说了一样的话"，而是找"在同一个议题上有不同/相关的视角"
2. 关注情绪模式——用户在不同时间的记录是否有相似的情绪基调
3. 关注认知矛盾——用户是否有前后不一致的想法或信念
4. 关注成长轨迹——用户后来是否解决了早期记录中的困惑
5. 每条关联必须引用具体的原文片段作为依据

请以 JSON 格式返回分析结果，格式如下：
{
  "associations": [
    {
      "targetRecordId": "历史记录的ID（方括号里的8位字符）",
      "targetDate": "历史记录的日期",
      "reason": "关联原因，用温和的第一人称（如：三个月前你也想过这个问题...）",
      "category": "同一主题 | 情绪模式 | 认知矛盾 | 成长轨迹 | 外部触发",
      "confidence": "high | medium | low",
      "evidence": "从新记录和历史记录中引用的具体原文"
    }
  ],
  "externalKnowledge": {
    "framework": "可能解释这些记录的外部知识框架（书/理论/心理学概念）",
    "explanation": "用这个框架解释用户经历的1-2句话",
    "source": "具体来源，格式：书名《xxx》/ 作者全名 / 论文标题。必须是你确认真实存在的来源。不确定就写 null",
    "relevance": "为什么这个框架适用于用户"
  } 或 null（如果找不到合适的外部知识）
}

重要：
- 只返回有真实关联的记录。如果某条历史记录与当前记录没有实质关联，不要强行关联。关联数量控制在 1-5 条。
- externalKnowledge.source 必须填写具体的、真实存在的来源（书名/作者/论文标题）。空泛表述如"心理学研究表明"一律不允许。无法确认来源真实性时，source 字段必须写 null。编造来源比漏掉来源更糟。`;

  const userMessage = `新记录：
---
${newRecord.content}
---

历史记录：
---
${historicalSummaries}
---

请分析新记录与历史记录之间的关联。`;

  const result = await chatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    model: getModel(),
    temperature: 0.5,
    maxTokens: 2048,
  });

  const text = result.choices[0].message.content;
  // Extract JSON from markdown code block if present
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  const jsonStr = jsonMatch ? jsonMatch[1] : text;

  try {
    return JSON.parse(jsonStr);
  } catch {
    // If JSON parsing fails, try to extract what we can
    return { associations: [], externalKnowledge: null, rawResponse: text };
  }
}

/**
 * Generate SOP from user's question and related records.
 * Engine③ — SOP incubation.
 */
export async function generateSOP(question, relatedRecords) {
  const recordsText = relatedRecords
    .map(r => `---\n日期: ${new Date(r.createdAt).toLocaleDateString('zh-CN')}\n内容: ${r.content}`)
    .join('\n');

  const systemPrompt = `你是织光 LightWeave 的 SOP 孵化引擎。用户基于自己的记录问了一个问题，你需要从他们的记录中提炼出个人方法论。

要求：
1. 从用户的记录中找规律、经验、教训
2. 提炼成可操作的步骤（3-7步）
3. 每步需引用用户的具体记录作为案例
4. 用温和的、像"未来的自己写给现在的自己"的语气
5. 不要编造用户没经历过的建议
6. title 必须从用户提问中直接派生——提取问题的核心主题词作为标题基础，确保同一问题每次生成的标题一致。例如"关于团队协作我有什么经验"→ title 始终为"团队协作方法论"

请以 JSON 格式返回：
{
  "title": "SOP 标题（从问题核心主题词派生，同一问题每次返回相同标题）",
  "steps": [
    {
      "stepNumber": 1,
      "title": "步骤标题",
      "description": "具体操作说明",
      "sourceRecordId": "引用的记录ID",
      "sourceQuote": "引用的原文"
    }
  ],
  "summary": "1-2句话总结这个SOP"
}`;

  const result = await chatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `用户的问题：${question}\n\n相关记录：\n${recordsText}` },
    ],
    model: getModel(),
    temperature: 0.5,
    maxTokens: 2048,
  });

  const text = result.choices[0].message.content;
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  const jsonStr = jsonMatch ? jsonMatch[1] : text;

  try {
    return JSON.parse(jsonStr);
  } catch {
    return { title: '分析结果', steps: [], summary: text, rawResponse: text };
  }
}

/**
 * Q&A — user asks a question, AI answers based on records.
 */
export function answerQuestion(question, records, conversationHistory = []) {
  const recordsContext = records
    .slice(0, 30)
    .map(r => `[${r.id.slice(0, 8)}] ${new Date(r.createdAt).toLocaleDateString('zh-CN')}: ${r.content.slice(0, 300)}`)
    .join('\n---\n');

  const systemPrompt = `你是织光 LightWeave，一个个人AI认知伴侣。你基于用户的所有记录来回答他们的问题。

规则：
1. 回答必须引用具体的记录作为依据
2. 用温和的第一人称——像了解用户的朋友，而不是医生或老师
3. 如果记录不足以回答这个问题，诚实告知，不要编造
4. 发现用户记录中的模式时，用"我注意到..."而不是"你应该..."
5. 每条回答末尾列出引用的记录ID和日期

用户的记录：
${recordsContext}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-10),
    { role: 'user', content: question },
  ];

  return streamChatCompletion({ messages, model: getModel(), temperature: 0.7, maxTokens: 2048 });
}

/**
 * Generate weekly insight from this week's records against historical context.
 */
export async function generateWeeklyInsight(weekRecords, historicalRecords) {
  const weekSummaries = weekRecords
    .map(r => `[${r.id.slice(0, 8)}] ${new Date(r.createdAt).toLocaleDateString('zh-CN')}: ${r.content.slice(0, 300)}`)
    .join('\n---\n');

  const historicalSummaries = historicalRecords
    .slice(0, 20)
    .map(r => `[${r.id.slice(0, 8)}] ${new Date(r.createdAt).toLocaleDateString('zh-CN')}: ${r.content.slice(0, 200)}`)
    .join('\n---\n');

  const systemPrompt = `你是织光 LightWeave 的周度洞察引擎。你的任务是基于用户本周的记录，生成一份温暖的、有洞察力的周度回顾。

分析原则：
1. 从本周记录中提取 3-6 个高频关键词/主题
2. 感知本周的情绪基调——与历史记录相比，是更平静、更焦虑、更充实还是更低落
3. 找出本周记录与历史记录之间的 2-3 个亮点关联——不是简单相似，而是认知上的呼应或成长
4. 用温和的第一人称，像"了解你的朋友在帮你做周度复盘"

请以 JSON 格式返回：
{
  "keywords": ["关键词1", "关键词2", ...],
  "moodTrend": "1-2句话描述本周情绪趋势，与过去对比",
  "highlights": [
    {
      "reason": "关联原因，温和第一人称",
      "recordId": "关联的历史记录ID（方括号里的8位字符）",
      "recordDate": "历史记录日期"
    }
  ],
  "summary": "一句话总结本周的认知收获"
}

重要：
- 只返回真实存在的模式，不要编造
- 如果本周记录不足（< 3条），在 summary 中温和地鼓励用户多记录
- 关键词必须从本周记录中提取，不要使用泛泛的词
- highlights 中的 recordId 必须是历史记录的真实 ID`;

  const userMessage = `本周记录：
---
${weekSummaries}
---

历史记录（用于对比和找关联）：
---
${historicalSummaries || '（暂无历史记录）'}
---`;

  const result = await chatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    model: getModel(),
    temperature: 0.5,
    maxTokens: 1536,
  });

  const text = result.choices[0].message.content;
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  const jsonStr = jsonMatch ? jsonMatch[1] : text;

  try {
    return JSON.parse(jsonStr);
  } catch {
    return { keywords: [], moodTrend: '', highlights: [], summary: text, rawResponse: text };
  }
}
