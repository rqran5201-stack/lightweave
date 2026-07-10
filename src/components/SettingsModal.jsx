import { useState } from 'react';

export function SettingsModal({ onClose, onSaved }) {
  const [key, setKey] = useState(
    localStorage.getItem('llm_api_key') || localStorage.getItem('deepseek_api_key') || ''
  );
  const [apiBase, setApiBase] = useState(localStorage.getItem('llm_api_base') || '');
  const [model, setModel] = useState(localStorage.getItem('llm_model') || '');
  const [showGuide, setShowGuide] = useState(false);

  const handleSave = () => {
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

    const m = model.trim();
    if (m) {
      localStorage.setItem('llm_model', m);
    } else {
      localStorage.removeItem('llm_model');
    }

    onSaved(k);
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <h3>&#9881; 设置</h3>

        <label style={{ fontSize: 14, color: 'var(--color-secondary)', display: 'block', marginBottom: 6 }}>
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
          onClick={() => setShowGuide(!showGuide)}
          style={{ marginBottom: showGuide ? 12 : 0 }}
        >
          {showGuide ? '收起 ▲' : '如何获取 API Key？▼'}
        </button>

        {showGuide && (
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

        <label style={{ fontSize: 14, color: 'var(--color-secondary)', display: 'block', marginBottom: 6, marginTop: 16 }}>
          模型
        </label>
        <input
          type="text"
          placeholder="deepseek-chat"
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />
        <p style={{ fontSize: 12, color: 'var(--color-tertiary)', marginBottom: 0, lineHeight: 1.5 }}>
          留空默认 deepseek-chat。其他常用：deepseek-reasoner / gpt-4o / claude-sonnet-4-6 / qwen2.5
        </p>

        <p style={{ fontSize: 13, color: 'var(--color-tertiary)', marginTop: 20, marginBottom: 0, lineHeight: 1.6 }}>
          &#128274; 所有数据只存在你的浏览器里。<br />
          &#9888; 清除浏览器数据会丢失所有记录。建议定期导出备份。<br />
          <span style={{ color: 'var(--color-secondary)' }}>版本 v1.3 · 织光 LightWeave</span>
        </p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSave}>保存</button>
        </div>
      </div>
    </div>
  );
}
