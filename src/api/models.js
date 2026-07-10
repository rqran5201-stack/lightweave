/**
 * Model catalog for 织光 LightWeave.
 * Free models go through the Cloudflare Worker proxy; custom models go direct.
 */

export const FREE_MODELS = [
  {
    id: '@cf/meta/llama-3.1-8b-instruct',
    provider: 'Cloudflare Workers AI',
    name: 'Llama 3.1 8B',
    description: '免费 · 速度快 · 推荐',
  },
  {
    id: '@cf/mistral/mistral-7b-instruct-v0.2',
    provider: 'Cloudflare Workers AI',
    name: 'Mistral 7B',
    description: '免费 · 逻辑推理强',
  },
  {
    id: 'gemini-2.0-flash',
    provider: 'Google Gemini',
    name: 'Gemini 2.0 Flash',
    description: '免费 · 需在代理端配置 GEMINI_API_KEY',
  },
];

export const CUSTOM_MODEL_PRESETS = [
  {
    id: 'deepseek-chat',
    provider: 'DeepSeek',
    name: 'DeepSeek Chat',
    description: '需自备 API Key',
  },
  {
    id: 'deepseek-reasoner',
    provider: 'DeepSeek',
    name: 'DeepSeek Reasoner',
    description: '需自备 API Key · 深度推理',
  },
];

export const ALL_MODELS = [...FREE_MODELS, ...CUSTOM_MODEL_PRESETS];

export const CUSTOM_MODEL_SENTINEL = '__custom__';

const FREE_IDS = new Set(FREE_MODELS.map(m => m.id));

export function isFreeModel(modelId) {
  return FREE_IDS.has(modelId);
}

/**
 * Check if the LLM is fully configured — either:
 *  A) User has an API key (custom models), OR
 *  B) User has a proxy URL AND a free model selected
 */
const DEFAULT_PROXY_URL = 'https://lightweave-proxy.lightweave.workers.dev/v1';

export function isLlmConfigured() {
  const key = localStorage.getItem('llm_api_key') || localStorage.getItem('deepseek_api_key');
  if (key) return true;

  const proxyUrl = localStorage.getItem('llm_proxy_url') || DEFAULT_PROXY_URL;
  const model = localStorage.getItem('llm_model') || getDefaultModel();
  if (proxyUrl && isFreeModel(model)) return true;

  return false;
}

export function getDefaultModel() {
  return localStorage.getItem('llm_model') || '@cf/meta/llama-3.1-8b-instruct';
}
