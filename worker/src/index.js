/**
 * LightWeave LLM Proxy — Cloudflare Worker
 *
 * Routes OpenAI-compatible /v1/chat/completions requests to:
 *  - Cloudflare Workers AI (free, models starting with @cf/)
 *  - Google Gemini (optional, models starting with gemini-)
 *
 * Deploy: cd worker && npm install && npx wrangler deploy
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message, status = 400) {
  return jsonResponse({ error: { message, type: 'proxy_error' } }, status);
}

function randomId() {
  return 'chatcmpl-' + crypto.randomUUID().slice(0, 29);
}

// ====== Workers AI ======

async function handleWorkersAI(env, model, messages, temperature, maxTokens) {
  const aiInput = { messages };
  if (temperature != null) aiInput.temperature = temperature;
  if (maxTokens != null) aiInput.max_tokens = maxTokens;

  const output = await env.AI.run(model, aiInput);
  return output.response;
}

async function handleWorkersAIStream(env, model, messages, temperature, maxTokens) {
  const aiInput = { messages, stream: true };
  if (temperature != null) aiInput.temperature = temperature;
  if (maxTokens != null) aiInput.max_tokens = maxTokens;

  const aiStream = await env.AI.run(model, aiInput);
  const id = randomId();
  let encoder = new TextEncoder();

  const sseStream = new ReadableStream({
    async start(controller) {
      const reader = aiStream.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            try {
              const parsed = JSON.parse(trimmed);
              const text = parsed.response || '';
              if (!text) continue;

              const chunk = {
                id,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model,
                choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
            } catch {
              // skip unparseable lines
            }
          }
        }

        // Final chunk
        const finalChunk = {
          id,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (e) {
        controller.error(e);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(sseStream, {
    headers: { ...CORS_HEADERS, 'Content-Type': 'text/event-stream' },
  });
}

// ====== Gemini ======

function convertMessagesToGemini(messages) {
  const contents = [];
  let systemInstruction = null;

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction = { parts: [{ text: msg.content }] };
    } else {
      const role = msg.role === 'assistant' ? 'model' : 'user';
      contents.push({ role, parts: [{ text: msg.content }] });
    }
  }

  // Gemini requires user/model alternating, merge consecutive same roles
  const merged = [];
  for (const c of contents) {
    const last = merged[merged.length - 1];
    if (last && last.role === c.role) {
      last.parts.push({ text: c.parts[0].text });
    } else {
      merged.push(c);
    }
  }

  return { contents: merged, systemInstruction };
}

async function handleGemini(env, modelId, messages, temperature, maxTokens) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key not configured. Run: npx wrangler secret put GEMINI_API_KEY');
  }

  const geminiModel = modelId.replace(/^gemini-/, '') || '2.0-flash';
  const body = convertMessagesToGemini(messages);

  if (temperature != null) body.generationConfig = { ...(body.generationConfig || {}), temperature };
  if (maxTokens != null) body.generationConfig = { ...(body.generationConfig || {}), maxOutputTokens: maxTokens };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-${geminiModel}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API error (${res.status})`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
  return text;
}

async function handleGeminiStream(env, modelId, messages, temperature, maxTokens) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key not configured.');
  }

  const geminiModel = modelId.replace(/^gemini-/, '') || '2.0-flash';
  const body = convertMessagesToGemini(messages);

  if (temperature != null) body.generationConfig = { ...(body.generationConfig || {}), temperature };
  if (maxTokens != null) body.generationConfig = { ...(body.generationConfig || {}), maxOutputTokens: maxTokens };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-${geminiModel}:streamGenerateContent?alt=sse&key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API error (${res.status})`);
  }

  // Gemini returns SSE natively; convert to OpenAI SSE format
  const id = randomId();
  let encoder = new TextEncoder();

  const sseStream = new ReadableStream({
    async start(controller) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            const data = trimmed.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const text = parsed.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
              if (!text) continue;

              const chunk = {
                id,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: modelId,
                choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
            } catch {
              // skip
            }
          }
        }

        const finalChunk = {
          id,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: modelId,
          choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (e) {
        controller.error(e);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(sseStream, {
    headers: { ...CORS_HEADERS, 'Content-Type': 'text/event-stream' },
  });
}

// ====== Main Handler ======

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    if (url.pathname !== '/v1/chat/completions' && url.pathname !== '/chat/completions') {
      return jsonResponse({ error: { message: 'Not Found' } }, 404);
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: { message: 'Method Not Allowed' } }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body');
    }

    const { model, messages, stream, temperature, max_tokens } = body;

    if (!model) return errorResponse('Missing "model" field');
    if (!messages || !Array.isArray(messages)) return errorResponse('Missing "messages" array');

    try {
      if (model.startsWith('@cf/')) {
        // Cloudflare Workers AI
        if (stream) {
          return await handleWorkersAIStream(env, model, messages, temperature, max_tokens);
        }
        const text = await handleWorkersAI(env, model, messages, temperature, max_tokens);
        return jsonResponse({
          id: randomId(),
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        });
      }

      if (model.startsWith('gemini-')) {
        if (stream) {
          return await handleGeminiStream(env, model, messages, temperature, max_tokens);
        }
        const text = await handleGemini(env, model, messages, temperature, max_tokens);
        return jsonResponse({
          id: randomId(),
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        });
      }

      return errorResponse(`Unsupported model: ${model}. Free models: @cf/meta/llama-3.1-8b-instruct, @cf/mistral/mistral-7b-instruct-v0.2`);
    } catch (e) {
      console.error('Proxy error:', e);
      return errorResponse(e.message || 'Internal proxy error', 500);
    }
  },
};
