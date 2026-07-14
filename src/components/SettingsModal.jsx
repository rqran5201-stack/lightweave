import { useState, useRef, useEffect } from 'react';
import { FREE_MODELS, CUSTOM_MODEL_PRESETS, ALL_MODELS, CUSTOM_MODEL_SENTINEL, isFreeModel, getDefaultModel } from '../api/models';
import { exportAllData, exportEncryptedBackup, validateBackup, readBackupFile, importBackup, decryptAndImportBackup } from '../api/backup';
import { getSetting } from '../store/db';
import { useToast } from '../App';

export function SettingsModal({ onClose, onSaved }) {
  const showToast = useToast();
  const [selectedModel, setSelectedModel] = useState(getDefaultModel());
  const [proxyUrl, setProxyUrl] = useState(
    localStorage.getItem('llm_proxy_url') || 'https://lightweave-proxy.lightweave.workers.dev/v1'
  );
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

  // Backup states
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [importError, setImportError] = useState('');
  const [importDone, setImportDone] = useState(false);
  const fileInputRef = useRef(null);

  // Encryption states
  const [showEncryptSection, setShowEncryptSection] = useState(false);
  const [encryptPassword, setEncryptPassword] = useState('');
  const [encryptConfirmPassword, setEncryptConfirmPassword] = useState('');
  const [encryptError, setEncryptError] = useState('');
  const [encryptExporting, setEncryptExporting] = useState(false);
  const [encryptImporting, setEncryptImporting] = useState(false);
  const [encryptImportStep, setEncryptImportStep] = useState('idle');
  const [encryptImportFile, setEncryptImportFile] = useState(null);
  const [hasEncryptionConfig, setHasEncryptionConfig] = useState(false);

  useEffect(() => {
    getSetting('encryption_salt').then(salt => {
      if (salt) setHasEncryptionConfig(true);
    });
  }, []);

  const modelIsFree = isFreeModel(selectedModel);
  const showCustomInput = selectedModel === CUSTOM_MODEL_SENTINEL;
  const effectiveModelId = showCustomInput ? customModelId : selectedModel;

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportAllData();
    } catch (e) {
      setExporting(false);
    }
  };

  const handleFilePicked = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportError('');
    setImportDone(false);
    setEncryptImportStep('idle');
    setEncryptImportFile(null);
    try {
      const json = await readBackupFile(file);
      const result = validateBackup(json);
      if (!result.valid) {
        setImportError(result.error);
        return;
      }
      if (result.encrypted) {
        setEncryptImportFile(json);
        setEncryptImportStep('awaitingPassword');
        return;
      }
      setImportSummary({ json, summary: result.summary });
    } catch (err) {
      setImportError(err.message || '文件读取失败');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportConfirm = async () => {
    if (!importSummary) return;
    setImporting(true);
    setImportError('');
    try {
      const result = await importBackup(importSummary.json);
      setImportSummary(null);
      setImportDone(true);
    } catch (err) {
      setImportError(err.message || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const handleEncryptedExport = async () => {
    setEncryptError('');
    if (encryptPassword.length < 8) {
      setEncryptError('密码至少需要 8 个字符');
      return;
    }
    if (encryptPassword !== encryptConfirmPassword) {
      setEncryptError('两次输入的密码不一致');
      return;
    }
    setEncryptExporting(true);
    try {
      await exportEncryptedBackup(encryptPassword);
      setHasEncryptionConfig(true);
      setShowEncryptSection(false);
      setEncryptPassword('');
      setEncryptConfirmPassword('');
      showToast('加密备份已导出');
    } catch (e) {
      setEncryptError(e.message || '加密导出失败');
    } finally {
      setEncryptExporting(false);
    }
  };

  const handleEncryptedImport = async () => {
    if (!encryptImportFile || !encryptPassword) return;
    setEncryptImporting(true);
    setEncryptError('');
    try {
      const imported = await decryptAndImportBackup(encryptImportFile, encryptPassword);
      setEncryptImportStep('idle');
      setEncryptImportFile(null);
      setEncryptPassword('');
      setImportDone(true);
    } catch (e) {
      setEncryptError(e.message || '密码错误或文件已损坏');
    } finally {
      setEncryptImporting(false);
    }
  };

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

        {/* Data Management */}
        <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--color-border-light)' }}>
          <h4 style={{ fontSize: 15, color: 'var(--color-on-surface)', marginBottom: 4, fontWeight: 600 }}>
            &#128451; 数据管理
          </h4>
          <p style={{ fontSize: 13, color: 'var(--color-tertiary)', marginBottom: 16, lineHeight: 1.6 }}>
            所有数据只存在此浏览器的本地存储中。清除浏览器数据会导致记录丢失，建议定期备份。
          </p>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleExport}
              disabled={exporting}
              style={{ flex: 1 }}
            >
              {exporting ? '导出中...' : '💾 导出备份'}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              style={{ flex: 1 }}
            >
              {importing ? '导入中...' : '📥 导入恢复'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.lightweave"
              style={{ display: 'none' }}
              onChange={handleFilePicked}
            />
          </div>

          {/* Import confirmation */}
          {importSummary && (
            <div style={{
              background: 'var(--color-insight-highlight-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 18px',
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: 'var(--color-on-surface)' }}>
                确认导入备份？
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-secondary)', lineHeight: 1.8, marginBottom: 12 }}>
                备份时间：{importSummary.summary.exportedAt ? new Date(importSummary.summary.exportedAt).toLocaleString('zh-CN') : '未知'}<br />
                包含：{importSummary.summary.records} 条记录、{importSummary.summary.associations} 条关联、{importSummary.summary.sops} 个 SOP、{importSummary.summary.qaMessages} 条问答<br />
                <span style={{ color: 'var(--color-warning)' }}>导入将与现有数据合并，不会覆盖已有记录。</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={handleImportConfirm} disabled={importing}>
                  {importing ? '导入中...' : '确认导入'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setImportSummary(null)}>取消</button>
              </div>
            </div>
          )}

          {/* Import error */}
          {importError && (
            <div style={{
              background: 'var(--color-danger-hover-bg)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              marginBottom: 16,
              fontSize: 13,
              color: 'var(--color-error)',
            }}>
              &#9888; {importError}
            </div>
          )}

          {/* Import success */}
          {importDone && (
            <div style={{
              background: '#F0F7F0',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
              marginBottom: 16,
              fontSize: 13,
              color: 'var(--color-success)',
              lineHeight: 1.6,
            }}>
              &#10003; 数据恢复完成。关闭设置后刷新页面即可看到导入的记录。
            </div>
          )}

          {/* Encrypted import: password prompt */}
          {encryptImportStep === 'awaitingPassword' && (
            <div className="encrypt-section">
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: 'var(--color-on-surface)' }}>
                此备份文件已加密，请输入密码
              </div>
              <p style={{ fontSize: 13, color: 'var(--color-tertiary)', marginBottom: 12, lineHeight: 1.6 }}>
                {encryptImportFile?.summary && (
                  <>包含 {encryptImportFile.summary.records || '?'} 条记录、{encryptImportFile.summary.associations || '?'} 条关联、{encryptImportFile.summary.sops || '?'} 个 SOP</>
                )}
              </p>
              <input
                type="password"
                placeholder="输入加密备份密码"
                value={encryptPassword}
                onChange={(e) => { setEncryptPassword(e.target.value); setEncryptError(''); }}
              />
              {encryptError && (
                <div style={{ color: 'var(--color-error)', fontSize: 12, marginTop: 8 }}>
                  &#9888; {encryptError}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn btn-primary btn-sm" onClick={handleEncryptedImport} disabled={encryptImporting || !encryptPassword}>
                  {encryptImporting ? '解密中...' : '解密并导入'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => {
                  setEncryptImportStep('idle'); setEncryptImportFile(null); setEncryptPassword(''); setEncryptError('');
                }}>
                  取消
                </button>
              </div>
            </div>
          )}

          {/* Encryption setup toggle */}
          {!hasEncryptionConfig && (
            <button
              className="qa-collapse-toggle"
              onClick={() => { setShowEncryptSection(!showEncryptSection); setEncryptError(''); }}
              style={{ width: '100%', justifyContent: 'center', marginBottom: 0, marginTop: 8 }}
            >
              {showEncryptSection ? '收起 ▲' : '🔒 设置加密备份'}
            </button>
          )}

          {/* Encryption setup panel */}
          {showEncryptSection && (
            <div className="encrypt-section">
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: 'var(--color-on-surface)' }}>
                设置加密备份密码
              </div>
              <p style={{ fontSize: 13, color: 'var(--color-tertiary)', marginBottom: 12, lineHeight: 1.6 }}>
                设置后备份文件将被 AES-256-GCM 加密。任何人拿到文件也无法看到内容——但请务必牢记密码，丢失后数据将永远无法恢复。
              </p>
              <input
                type="password"
                placeholder="输入密码（至少 8 个字符）"
                value={encryptPassword}
                onChange={(e) => { setEncryptPassword(e.target.value); setEncryptError(''); }}
                style={{ marginBottom: 8 }}
              />
              <input
                type="password"
                placeholder="再次输入密码"
                value={encryptConfirmPassword}
                onChange={(e) => setEncryptConfirmPassword(e.target.value)}
              />
              {encryptPassword.length > 0 && (
                <div className="encrypt-strength-bar">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="encrypt-strength-segment" style={{
                      background: encryptPassword.length >= i * 3
                        ? (i <= 2 ? 'var(--color-warning)' : 'var(--color-success)')
                        : 'var(--color-border)',
                    }} />
                  ))}
                </div>
              )}
              {encryptError && (
                <div style={{ color: 'var(--color-error)', fontSize: 12, marginBottom: 8 }}>
                  &#9888; {encryptError}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleEncryptedExport}
                  disabled={encryptExporting}
                  style={{ flex: 1 }}
                >
                  {encryptExporting ? '加密中...' : '🔒 导出加密备份 (.lightweave)'}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setShowEncryptSection(false); setEncryptPassword(''); setEncryptConfirmPassword(''); setEncryptError(''); }}
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {/* Quick encrypted export button (when already configured) */}
          {hasEncryptionConfig && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, marginTop: 12 }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={async () => {
                  if (!encryptPassword) {
                    setShowEncryptSection(true);
                    return;
                  }
                  setEncryptExporting(true);
                  setEncryptError('');
                  try {
                    await exportEncryptedBackup(encryptPassword);
                    showToast('加密备份已更新');
                  } catch (e) {
                    setEncryptError(e.message);
                  } finally {
                    setEncryptExporting(false);
                  }
                }}
                disabled={encryptExporting}
                style={{ flex: 1 }}
              >
                {encryptExporting ? '加密中...' : '🔒 更新加密备份'}
              </button>
            </div>
          )}
        </div>

        <p style={{ fontSize: 13, color: 'var(--color-tertiary)', marginTop: 20, marginBottom: 0, lineHeight: 1.6 }}>
          &#128274; 所有数据只存在你的浏览器里。上方可导出/恢复备份。<br />
          <span style={{ color: 'var(--color-secondary)' }}>版本 v2.1 · 织光 LightWeave</span>
        </p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSave}>保存</button>
        </div>
      </div>
    </div>
  );
}
