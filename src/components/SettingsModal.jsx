import { useState } from 'react';

export function SettingsModal({ onClose, onSaved }) {
  const [key, setKey] = useState(
    localStorage.getItem('llm_api_key') || localStorage.getItem('deepseek_api_key') || ''
  );
  const [apiBase, setApiBase] = useState(localStorage.getItem('llm_api_base') || '');
  const [model, setModel] = useState(localStorage.getItem('llm_model') || '');

  const handleSave = () => {
    const k = key.trim();
    if (k) {
      localStorage.setItem('llm_api_key', k);
      // Migrate old key
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
      <div className="modal" onClick={(e) => e.stopPropagation()}>
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
          &#9888; 清除浏览器数据会丢失所有记录。<br />
          <span style={{ color: 'var(--color-secondary)' }}>版本 v1.0 · 织光 LightWeave</span>
        </p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSave}>保存</button>
        </div>
      </div>
    </div>
  );
}
