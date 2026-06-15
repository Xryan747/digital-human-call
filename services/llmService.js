/**
 * Zhipu AI (智谱) LLM Service
 * OpenAI-compatible API at https://open.bigmodel.cn/api/paas/v4
 */

const LLM_CONFIG = {
  baseURL: 'https://open.bigmodel.cn/api/paas/v4',
  apiKey: process.env.ZHIPU_API_KEY,
};

const PERSONA_ANALYSIS_PROMPT = `你是一位专业的对话分析师。请分析以下聊天记录或人物描述，提取出一个完整的数字人角色设定。

要求输出 JSON 格式（不要加 markdown 代码块标记）：
{
  "name": "角色名字（2-4个字的中文名）",
  "traits": ["性格特点1", "性格特点2", "性格特点3"],
  "speechPatterns": ["说话习惯1", "说话习惯2", "说话习惯3"],
  "background": "人物背景简述（100字以内）",
  "systemPrompt": "一段完整的 system prompt，用于指导 AI 模仿这个角色说话。包含：身份设定、性格、说话风格、常用词汇、注意事项。用中文写，200字以内。"
}

注意：
- systemPrompt 必须是指令式的，用于发给另一个 AI 模型
- 如果聊天记录中体现了方言、口头禅等，务必在 speechPatterns 和 systemPrompt 中体现
- 根据人物设定选择合适的称呼方式（如：孙辈对长辈用"您"，长辈对孙辈用"乖乖"等）`;

async function analyzePersona(chatLogs) {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    throw new Error('ZHIPU_API_KEY not configured');
  }

  const truncated = chatLogs.length > 8000 ? chatLogs.slice(0, 8000) + '\n...(内容已截断)' : chatLogs;

  const response = await fetch(`${LLM_CONFIG.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'glm-4-plus',
      messages: [
        { role: 'system', content: PERSONA_ANALYSIS_PROMPT },
        { role: 'user', content: `请分析以下内容：\n\n${truncated}` },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Zhipu API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Zhipu returned empty response');
  }

  // Parse JSON from response (handle possible markdown wrapping)
  let cleaned = content.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  let persona;
  try {
    persona = JSON.parse(cleaned);
  } catch (e) {
    // Fallback: try to extract JSON object from text
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      persona = JSON.parse(match[0]);
    } else {
      throw new Error(`Failed to parse persona JSON from LLM response: ${content.slice(0, 200)}`);
    }
  }

  // Validate required fields
  if (!persona.name) persona.name = '未命名';
  if (!persona.systemPrompt) {
    persona.systemPrompt = `你是${persona.name}。${persona.background || ''}。请用自然的口语化中文回复，保持温暖亲切的语气。`;
  }
  if (!persona.traits) persona.traits = [];
  if (!persona.speechPatterns) persona.speechPatterns = [];
  if (!persona.background) persona.background = '';

  return persona;
}

async function chat(messages, systemPrompt) {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    throw new Error('ZHIPU_API_KEY not configured');
  }

  const fullMessages = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  const response = await fetch(`${LLM_CONFIG.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'glm-4-flash',
      messages: fullMessages,
      max_tokens: 150,
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Zhipu chat error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content;

  if (!reply) {
    throw new Error('Zhipu chat returned empty response');
  }

  return reply;
}

module.exports = { analyzePersona, chat };
