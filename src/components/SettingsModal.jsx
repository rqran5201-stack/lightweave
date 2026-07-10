import { useState } from 'react';
import { FREE_MODELS, CUSTOM_MODEL_PRESETS, ALL_MODELS, CUSTOM_MODEL_SENTINEL, isFreeModel, getDefaultModel } from '../api/models';

export function SettingsModal({ onClose, onSaved }) {
  const [selectedModel, setSelectedModel] = useState(getDefaultModel());
  const [proxyUrl, setProxyUrl] = useState(localStorage.getItem('llm_proxy_url') || '');
  const [customModelId, setCustomModelId] = useState(
    (() => {
      const current = localStorage.getItem('llm_model') || '';
      if (current && !ALL_MODELS.some(m => m.id === current) && current !== CUSTOM_MODEL_SENTINEL) {
        return current;
      }
      return '';
    })()
  );
  const [key, setKey] = useState(
    localStorage.getItem('llm_api_key') || localStorage.getItem('deepseek_api_key') || ''
  );
  const [apiBase, setApiBase] = useState(localStorage.getItem('llm_api_base') || '');
  const [showKeyGuide, setShowKeyGuide] = useState(false);
  const [showProxyGuide, setShowProxyGuide] = useState(false);

  const modelIsFree = isFreeModel(selectedModel);
  const showCustomInput = selectedModel === CUSTOM_MODEL_SENTINEL;
  const effectiveModelId = showCustomInput ? customModelId : selectedModel;

  const handleSave = () => {
    if (effectiveModelId) {
      localStorage.setItem('llm_model', effectiveModelId);
    } else {
      localStorage.removeItem('llm_model');
    }

    const pu = proxyUrl.trim();
    if (pu) {
      localStorage.setItem('llm_proxy_url', pu);
    } else {
      localStorage.removeItem('llm_proxy_url');
    }

    const k = key.trim();
    if (k) {
      localStorage.setItem('llm_api_key', k);
      if (localStorage.getItem('deepseek_api_key')) {
        localStorage.removeItem('deepseek_api_key');
      }
    } else {
      localStorage.removeItem('llm_api_key');
    }

    const base = apiBase.trim();
    if (base) {
      localStorage.setItem('llm_api_base', base);
    } else {
      localStorage.removeItem('llm_api_base');
    }

    onSaved();
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <h3>&#9881; 设置</h3>

        {/* Model Selector */}
        <label style={{ fontSize: 14, color: 'var(--color-secondary)', display: 'block', marginBottom: 6 }}>
          模型
        </label>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            fontSize: 14,
            fontFamily: 'var(--font-serif)',
            background: 'var(--color-surface)',
            color: 'var(--color-primary-text)',
            marginBottom: 12,
          }}
        >
          <optgroup label="免费模型（无需 API Key）">
            {FREE_MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.name} — {m.description}</option>
            ))}
          </optgroup>
          <optgroup label="自有模型（需自备 API Key）">
            {CUSTOM_MODEL_PRESETS.map(m => (
              <option key={m.id} value={m.id}>{m.name} — {m.description}</option>
            ))}
            <option value={CUSTOM_MODEL_SENTINEL}>其他（手动输入模型 ID）...</option>
          </optgroup>
        </select>

        {/* Custom model ID input */}
        {showCustomInput && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 14, color: 'var(--color-secondary)', display: 'block', marginBottom: 6 }}>
              模型 ID
            </label>
            <input
              type="text"
              placeholder="输入模型 ID，如 gpt-4o / claude-sonnet-4-6"
              value={customModelId}
              onChange={(e) => setCustomModelId(e.target.value)}
            />
          </div>
        )}

        {/* Proxy URL — for free models */}
        {modelIsFree && (
          <>
            <label style={{ fontSize: 14, color: 'var(--color-secondary)', display: 'block', marginBottom: 6, marginTop: 8 }}>
              代理地址
            </label>
            <input
              type="text"
              placeholder="https://你的-worker名.workers.dev/v1"
              value={proxyUrl}
              onChange={(e) => setProxyUrl(e.target.value)}
            />
            <p style={{ fontSize: 12, color: 'var(--color-tertiary)', marginBottom: 0, lineHeight: 1.5 }}>
              免费模型通过 Cloudflare Worker 代理访问，需自行部署（免费）。
            </p>

            <button
              className="qa-collapse-toggle"
              onClick={() => setShowProxyGuide(!showProxyGuide)}
              style={{ marginBottom: showProxyGuide ? 12 : 0 }}
            >
              {showProxyGuide ? '收起 ▲' : '如何部署代理？▼'}
            </button>

            {showProxyGuide && (
              <div className="api-key-guide">
                <div className="guide-step">
                  <span className="guide-step-num">1</span>
                  <div>
                    <div className="guide-step-title">注册 Cloudflare 账号</div>
                    <div className="guide-step-desc">
                      访问 <a href="https://dash.cloudflare.com/sign-up" target="_blank" rel="noopener">dash.cloudflare.com</a>，
                      免费注册。Workers 免费套餐：每日 10 万次请求，AI 推理每日 1 万神经元，个人使用完全够用。
                    </div>
                  </div>
                </div>
                <div className="guide-step">
                  <span className="guide-step-num">2</span>
                  <div>
                    <div className="guide-step-title">安装并登录 Wrangler</div>
                    <div className="guide-step-desc">
                      在终端运行：<br />
                      <code>npm install -g wrangler</code><br />
                      <code>wrangler login</code>
                    </div>
                  </div>
                </div>
                <div className="guide-step">
                  <span className="guide-step-num">3</span>
                  <div>
                    <div className="guide-step-title">部署代理 Worker</div>
                    <div className="guide-step-desc">
                      进入项目 <code>worker/</code> 目录：<br />
                      <code>cd worker</code><br />
                      <code>npm install</code><br />
                      <code>npx wrangler deploy</code>
                    </div>
                  </div>
                </div>
                <div className="guide-step">
                  <span className="guide-step-num">4</span>
                  <div>
                    <div className="guide-step-title">复制地址填入上方</div>
                    <div className="guide-step-desc">
                      部署成功后会显示 Worker URL，类似 <code>https://lightweave-proxy.你的用户名.workers.dev</code>。
                      把它粘贴到上方「代理地址」输入框，后面加上 <code>/v1</code>，保存即可。
                    </div>
                  </div>
                </div>
                <div className="guide-step">
                  <span className="guide-step-num">5</span>
                  <div>
                    <div className="guide-step-title">（可选）启用 Gemini</div>
                    <div className="guide-step-desc">
                      如果想用 Gemini 2.0 Flash，去 <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a> 获取免费 API Key，
                      然后运行 <code>npx wrangler secret put GEMINI_API_KEY</code> 并粘贴 Key。
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* API Key — for custom models */}
        {!modelIsFree && (
          <>
            <label style={{ fontSize: 14, color: 'var(--color-secondary)', display: 'block', marginBottom: 6, marginTop: 16 }}>
              API Key
            </label>
            <input
              type="password"
              placeholder="sk-..."
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />

            <button
              className="qa-collapse-toggle"
              onClick={() => setShowKeyGuide(!showKeyGuide)}
              style={{ marginBottom: showKeyGuide ? 12 : 0 }}
            >
              {showKeyGuide ? '收起 ▲' : '如何获取 API Key？▼'}
            </button>

            {showKeyGuide && (
              <div className="api-key-guide">
                <div className="guide-step">
                  <span className="guide-step-num">1</span>
                  <div>
                    <div className="guide-step-title">打开 DeepSeek 官网</div>
                    <div className="guide-step-desc">
                      浏览器访问 <a href="https://platform.deepseek.com" target="_blank" rel="noopener">platform.deepseek.com</a>，
                      点击右上角「登录 / 注册」。手机号或邮箱都可以，30 秒搞定。
                    </div>
                  </div>
                </div>
                <div className="guide-step">
                  <span className="guide-step-num">2</span>
                  <div>
                    <div className="guide-step-title">进入 API Keys 页面</div>
                    <div className="guide-step-desc">
                      登录后左侧菜单点击「API Keys」，或直接打开 <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener">platform.deepseek.com/api_keys</a>。
                    </div>
                  </div>
                </div>
                <div className="guide-step">
                  <span className="guide-step-num">3</span>
                  <div>
                    <div className="guide-step-title">创建一个 Key</div>
                    <div className="guide-step-desc">
                      点击「创建 API Key」按钮，随便起个名字（比如"织光"），系统会生成一串 <code>sk-</code> 开头的字符。
                    </div>
                  </div>
                </div>
                <div className="guide-step">
                  <span className="guide-step-num">4</span>
                  <div>
                    <div className="guide-step-title">复制粘贴到上面</div>
                    <div className="guide-step-desc">
                      点击复制，把 <code>sk-xxxxx</code> 粘贴到上方输入框，点保存。
                      <strong>Key 只显示一次，请立即复制。</strong>
                    </div>
                  </div>
                </div>
                <div className="guide-step">
                  <span className="guide-step-num">5</span>
                  <div>
                    <div className="guide-step-title">检查余额</div>
                    <div className="guide-step-desc">
                      新用户注册即送免费额度。之后按用量计费，一条记录关联分析约花几分钱。在「Usage」页面可以随时看用量。
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 14, padding: '10px 14px', background: '#FFFBF7', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--color-secondary)', lineHeight: 1.6 }}>
                  &#128161; <strong>为什么需要 API Key？</strong>织光没有自己的服务器，AI 功能由你直接调用大模型实现。你的 Key、你的记录、你的浏览器——三方闭环，谁也看不到你的数据。
                </div>
              </div>
            )}

            <label style={{ fontSize: 14, color: 'var(--color-secondary)', display: 'block', marginBottom: 6, marginTop: 16 }}>
              API 地址
            </label>
            <input
              type="text"
              placeholder="https://api.deepseek.com/v1"
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
            />
            <p style={{ fontSize: 12, color: 'var(--color-tertiary)', marginBottom: 0, lineHeight: 1.5 }}>
              留空默认 DeepSeek。也支持 OpenAI / Ollama / 任何兼容接口
            </p>
          </>
        )}

        <p style={{ fontSize: 13, color: 'var(--color-tertiary)', marginTop: 20, marginBottom: 0, lineHeight: 1.6 }}>
          &#128274; 所有数据只存在你的浏览器里。<br />
          &#9888; 清除浏览器数据会丢失所有记录。建议定期导出备份。<br />
          <span style={{ color: 'var(--color-secondary)' }}>版本 v2.0 · 织光 LightWeave</span>
        </p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSave}>保存</button>
        </div>
      </div>
    </div>
  );
}
