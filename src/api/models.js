/**
 * Model catalog for 织光 LightWeave.
 * Free models go through the Cloudflare Worker proxy; custom models go direct.
 */

export const FREE_MODELS = [
  {
    id: '@cf/qwen/qwen3-30b-a3b-fp8',
    provider: 'Cloudflare Workers AI',
    name: 'Qwen3 30B',
    description: '免费 · 中文最佳 · 推荐',
  },
  {
    id: '@cf/meta/llama-3.1-8b-instruct-fp8-fast',
    provider: 'Cloudflare Workers AI',
    name: 'Llama 3.1 8B',
    description: '免费 · 速度快 · 通用',
  },
  {
    id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
    provider: 'Cloudflare Workers AI',
    name: 'DeepSeek R1 (Qwen 32B)',
    description: '免费 · 深度推理 · 稍慢',
  },
  {
    id: 'gemini-2.0-flash',
    provider: 'Google Gemini',
    name: 'Gemini 2.0 Flash',
    description: '免费 · 需代理端配 GEMINI_API_KEY',
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

// Deprecated model IDs that should still be treated as free models
// and auto-migrated to the replacement
const DEPRECATED_FREE_IDS = new Set([
  '@cf/meta/llama-3.1-8b-instruct',
  '@cf/meta/llama-3.1-8b-instruct-awq',
  '@cf/meta/llama-3-8b-instruct',
  '@cf/mistral/mistral-7b-instruct-v0.2',
  '@cf/mistral/mistral-7b-instruct-v0.1',
]);

export function isFreeModel(modelId) {
  return FREE_IDS.has(modelId) || DEPRECATED_FREE_IDS.has(modelId);
}

/** Auto-migrate deprecated model to its current replacement. */
export function migrateModel(modelId) {
  const map = {
    '@cf/meta/llama-3.1-8b-instruct': '@cf/qwen/qwen3-30b-a3b-fp8',
    '@cf/meta/llama-3.1-8b-instruct-awq': '@cf/meta/llama-3.1-8b-instruct-fp8-fast',
    '@cf/meta/llama-3-8b-instruct': '@cf/meta/llama-3.1-8b-instruct-fp8-fast',
    '@cf/mistral/mistral-7b-instruct-v0.2': '@cf/meta/llama-3.1-8b-instruct-fp8-fast',
    '@cf/mistral/mistral-7b-instruct-v0.1': '@cf/meta/llama-3.1-8b-instruct-fp8-fast',
  };
  return map[modelId] || modelId;
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
  return localStorage.getItem('llm_model') || '@cf/qwen/qwen3-30b-a3b-fp8';
}
