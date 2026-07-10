import { useState, useRef, useCallback } from 'react';
import { useToast } from '../App';
import { parseFile } from '../api/import';
import { batchImportRecords } from '../store/db';

export function ImportZone({ onImported }) {
  const showToast = useToast();
  const [mode, setMode] = useState('file'); // 'file' | 'paste'
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [pasteSplit, setPasteSplit] = useState('separator'); // 'separator' | 'blank' | 'single'
  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);

  const doImport = useCallback(async (items) => {
    if (items.length === 0) {
      showToast('未发现可导入的内容');
      return;
    }
    setImporting(true);
    setProgress(`正在导入 ${items.length} 条记录...`);
    try {
      const saved = await batchImportRecords(items);
      showToast(`已导入 ${saved.length} 条记录`);
      if (onImported) onImported(saved);
    } catch (e) {
      showToast('导入失败：' + (e.message || '未知错误'));
    } finally {
      setImporting(false);
      setProgress('');
    }
  }, [showToast, onImported]);

  // ====== File mode ======

  const processFiles = useCallback(async (files) => {
    if (files.length === 0) return;
    setImporting(true);
    setProgress(`正在读取 ${files.length} 个文件...`);
    try {
      let allItems = [];
      for (const file of files) {
        const items = await parseFile(file);
        allItems = allItems.concat(items);
      }
      await doImport(allItems);
    } catch (e) {
      showToast('导入失败：' + (e.message || '未知错误'));
      setImporting(false);
      setProgress('');
    }
  }, [showToast, doImport]);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current++;
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) { dragCounter.current = 0; setDragging(false); }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    setDragging(false); dragCounter.current = 0;
    const files = Array.from(e.dataTransfer.files).filter(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      return ['txt', 'md', 'json', 'csv'].includes(ext);
    });
    if (files.length === 0) { showToast('支持 .txt / .md / .json 文件'); return; }
    processFiles(files);
  }, [processFiles, showToast]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) processFiles(files);
    e.target.value = '';
  };

  // ====== Paste mode ======

  const handlePasteImport = () => {
    const text = pasteText.trim();
    if (!text) { showToast('请先粘贴文字'); return; }

    let items = [];
    if (pasteSplit === 'single') {
      items = [{ content: text }];
    } else if (pasteSplit === 'separator') {
      // Split by --- or *** or ___ on its own line
      const parts = text.split(/\n{0,2}(?:---+|\*\*\*+|___+)\n{0,2}/);
      items = parts.filter(p => p.trim()).map(p => ({ content: p.trim() }));
    } else if (pasteSplit === 'blank') {
      // Split by double newline (blank line)
      const parts = text.split(/\n\s*\n/);
      items = parts.filter(p => p.trim()).map(p => ({ content: p.trim() }));
    }

    if (items.length === 0) {
      showToast('未识别到可导入的内容');
      return;
    }
    setPasteText('');
    doImport(items);
  };

  const pasteCharCount = pasteText.length;
  // Estimate record count for preview
  let estimatedRecords = 0;
  if (pasteText.trim()) {
    if (pasteSplit === 'single') estimatedRecords = 1;
    else if (pasteSplit === 'separator') estimatedRecords = pasteText.split(/\n{0,2}(?:---+|\*\*\*+|___+)\n{0,2}/).filter(p => p.trim()).length;
    else estimatedRecords = pasteText.split(/\n\s*\n/).filter(p => p.trim()).length;
  }

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border-light)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      {/* Tab switcher */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border-light)' }}>
        <button
          onClick={() => setMode('file')}
          style={{
            flex: 1, padding: '10px 16px', border: 'none', background: 'none',
            fontSize: 14, fontFamily: 'var(--font-serif)', cursor: 'pointer',
            color: mode === 'file' ? 'var(--color-primary)' : 'var(--color-tertiary)',
            borderBottom: mode === 'file' ? '2px solid var(--color-primary)' : '2px solid transparent',
            marginBottom: -1, transition: 'var(--transition)',
          }}
        >&#128206; 拖拽文件</button>
        <button
          onClick={() => setMode('paste')}
          style={{
            flex: 1, padding: '10px 16px', border: 'none', background: 'none',
            fontSize: 14, fontFamily: 'var(--font-serif)', cursor: 'pointer',
            color: mode === 'paste' ? 'var(--color-primary)' : 'var(--color-tertiary)',
            borderBottom: mode === 'paste' ? '2px solid var(--color-primary)' : '2px solid transparent',
            marginBottom: -1, transition: 'var(--transition)',
          }}
        >&#128203; 粘贴文字</button>
      </div>

      <div style={{ padding: 20 }}>
        {/* ====== File mode ====== */}
        {mode === 'file' && (
          <div>
            <div
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={importing ? undefined : () => fileInputRef.current?.click()}
              style={{
                border: `1.5px dashed ${dragging ? 'var(--color-primary)' : 'var(--color-border)'}`,
                borderRadius: 'var(--radius-md)',
                padding: importing ? '18px 20px' : '28px 20px',
                textAlign: 'center',
                cursor: importing ? 'default' : 'pointer',
                transition: 'var(--transition)',
                background: dragging ? 'var(--color-primary-light)' : 'var(--color-bg)',
              }}
            >
              {importing ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                  <div className="spinner" />
                  <span style={{ fontSize: 14, color: 'var(--color-secondary)' }}>{progress}</span>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 28, marginBottom: 6, opacity: dragging ? 1 : 0.5 }}>&#128229;</div>
                  <p style={{ fontSize: 14, color: 'var(--color-on-surface)', marginBottom: 2 }}>
                    拖拽文件到此处，或点击选择
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--color-tertiary)' }}>
                    .txt / .md / .json · .md 按 ## 标题自动拆分
                  </p>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept=".txt,.md,.json,.csv" multiple
              style={{ display: 'none' }} onChange={handleFileChange} />
          </div>
        )}

        {/* ====== Paste mode ====== */}
        {mode === 'paste' && (
          <div>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="从微信 / Notion / 备忘录 / Obsidian 里复制文字，粘贴到这里..."
              style={{
                width: '100%', minHeight: 140, maxHeight: 320,
                padding: 14, border: '1.5px solid var(--color-border)',
                borderRadius: 'var(--radius-md)', fontSize: 14, lineHeight: 1.7,
                fontFamily: 'var(--font-serif)', color: 'var(--color-on-surface)',
                background: 'var(--color-bg)', resize: 'vertical', outline: 'none',
                transition: 'var(--transition)',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { value: 'separator', label: '按 --- 拆分' },
                  { value: 'blank', label: '按空行拆分' },
                  { value: 'single', label: '整体导入' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setPasteSplit(opt.value)}
                    style={{
                      padding: '4px 10px', borderRadius: 'var(--radius-full)',
                      border: '1px solid ' + (pasteSplit === opt.value ? 'var(--color-primary)' : 'var(--color-border)'),
                      background: pasteSplit === opt.value ? 'var(--color-primary-light)' : 'transparent',
                      color: pasteSplit === opt.value ? 'var(--color-primary)' : 'var(--color-secondary)',
                      fontSize: 12, fontFamily: 'var(--font-serif)', cursor: 'pointer',
                      transition: 'var(--transition)',
                    }}
                  >{opt.label}</button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--color-tertiary)' }}>
                  {estimatedRecords > 0 ? `识别为 ${estimatedRecords} 条记录` : `${pasteCharCount} 字`}
                </span>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!pasteText.trim() || importing}
                  onClick={handlePasteImport}
                >
                  导入
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
