import { useState, useRef, useEffect } from 'react';
import { useToast } from '../App';

export function ExportPopover({ context, record, associations, externalKnowledge, onClose }) {
  const showToast = useToast();
  const [scope, setScope] = useState('both');
  const [format, setFormat] = useState('md');
  const popoverRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const scopeLabels = { both: '笔记+AI生成', note: '仅笔记', ai: '仅AI生成' };
  const formatLabels = { md: 'Markdown (.md)', png: '精美图片卡片 (.png)', pdf: 'PDF (.pdf)', txt: '纯文本 (.txt)' };

  const txtDisabled = scope === 'ai';

  const handleExport = () => {
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    const prefix = context === 'sop' ? '织光_SOP' : '织光_记录';
    const extMap = { md: '.md', png: '.png', pdf: '.pdf', txt: '.txt' };

    // Build export content
    let content = '';
    if (scope === 'both' || scope === 'note') {
      content += record?.content || '';
    }
    if ((scope === 'both' || scope === 'ai') && associations?.length > 0) {
      content += '\n\n---\n## AI 关联分析\n\n';
      associations.forEach(a => {
        content += `- **${a.category || '关联'}**: ${a.reason}\n  - 置信度: ${a.confidence}\n  - 依据: ${a.evidence}\n\n`;
      });
    }
    if ((scope === 'both' || scope === 'ai') && externalKnowledge) {
      content += `\n## 外部知识\n\n${externalKnowledge.framework}\n${externalKnowledge.explanation}\n来源: ${externalKnowledge.source}\n`;
    }

    if (format === 'png') {
      showToast('🖼️ 图片卡片功能将在后续版本实现（Canvas API 渲染 750×1000px）');
      onClose();
      return;
    }

    const mimeMap = { md: 'text/markdown', txt: 'text/plain', pdf: 'application/pdf' };
    const blob = new Blob([content], { type: mimeMap[format] || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = prefix + '_' + ts + extMap[format];
    a.click();
    URL.revokeObjectURL(url);
    showToast(`已导出 ${formatLabels[format]}`);
    onClose();
  };

  return (
    <div className="export-popover" ref={popoverRef} style={{ top: 'auto', bottom: 'auto', right: 24 }}>
      <button className="export-close" onClick={onClose}>&#10005;</button>

      {/* Step 1: Content scope */}
      <div>
        <div className="export-step-label">导出内容范围</div>
        <div className="export-options">
          {[
            { value: 'both', icon: '&#128221;+&#129302;', label: '笔记+AI生成' },
            { value: 'note', icon: '&#128221;', label: '仅笔记' },
            { value: 'ai', icon: '&#129302;', label: '仅AI生成' },
          ].map(opt => (
            <button key={opt.value}
              className={`export-option${scope === opt.value ? ' selected' : ''}`}
              onClick={() => setScope(opt.value)}>
              <span className="option-icon" dangerouslySetInnerHTML={{ __html: opt.icon }} />
              <span className="option-text">{opt.label}</span>
              <span className="option-check">{scope === opt.value ? '✓' : ''}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Format */}
      <div>
        <div className="export-step-label">导出格式</div>
        <div className="export-options">
          {[
            { value: 'md', icon: '&#128196;', label: 'Markdown (.md)' },
            { value: 'png', icon: '&#127912;', label: '精美图片卡片 (.png)' },
            { value: 'pdf', icon: '&#128214;', label: 'PDF (.pdf)' },
            { value: 'txt', icon: '&#128221;', label: '纯文本 (.txt)', disabled: txtDisabled },
          ].map(opt => (
            <button key={opt.value}
              className={`export-option${format === opt.value ? ' selected' : ''}`}
              style={opt.disabled ? { opacity: 0.4, pointerEvents: 'none' } : {}}
              onClick={() => !opt.disabled && setFormat(opt.value)}>
              <span className="option-icon" dangerouslySetInnerHTML={{ __html: opt.icon }} />
              <span className="option-text">{opt.label}</span>
              <span className="option-check">{format === opt.value ? '✓' : ''}</span>
            </button>
          ))}
        </div>
        <button className="export-download-btn" onClick={handleExport}>
          导出 {scopeLabels[scope]} · {formatLabels[format]?.split(' ')[0]}
        </button>
      </div>
    </div>
  );
}
