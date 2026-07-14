import { useState, useRef, useEffect } from 'react';
import { useToast } from '../App';
import { renderExportCard } from '../api/export-card';

export function ExportPopover({ context, record, associations, externalKnowledge, onClose }) {
  const showToast = useToast();
  const [scope, setScope] = useState('both');
  const [format, setFormat] = useState('md');
  const [rendering, setRendering] = useState(false);
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

  const getTimestamp = () => {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
  };

  const getFilename = (ext) => {
    const prefix = context === 'sop' ? '织光_SOP' : '织光_记录';
    return `${prefix}_${getTimestamp()}${ext}`;
  };

  const getDateStr = () => {
    return new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  };

  // Build plain-text content for MD/TXT export
  const buildTextContent = () => {
    let content = '';
    if (scope === 'both' || scope === 'note') {
      content += record?.content || '';
    }
    if ((scope === 'both' || scope === 'ai') && associations?.length > 0) {
      content += '\n\n---\n## AI 关联分析\n\n';
      associations.forEach(a => {
        if (!a) return;
        content += `- **${a.category || '关联'}**: ${a.reason || ''}\n  - 置信度: ${a.confidence || ''}\n  - 依据: ${a.evidence || ''}\n\n`;
      });
    }
    if ((scope === 'both' || scope === 'ai') && externalKnowledge) {
      content += `\n## 外部知识\n\n${externalKnowledge.framework || ''}\n${externalKnowledge.explanation || ''}\n来源: ${externalKnowledge.source || ''}\n`;
    }
    return content;
  };

  const triggerDownload = (url, filename) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Render canvas card → download as PNG
  const exportPNG = async () => {
    setRendering(true);
    try {
      const canvas = renderExportCard({
        content: record?.content || '',
        associations: associations || [],
        externalKnowledge: externalKnowledge || null,
        scope,
        dateStr: getDateStr(),
      });
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Canvas toBlob returned null'));
        }, 'image/png');
      });
      const url = URL.createObjectURL(blob);
      triggerDownload(url, getFilename('.png'));
      URL.revokeObjectURL(url);
      showToast('图片卡片已导出');
    } catch (e) {
      console.error('PNG export failed:', e);
      showToast('导出失败：' + (e.message || '请重试'));
    } finally {
      setRendering(false);
      onClose();
    }
  };

  // Render canvas card → embed in PDF → download
  const exportPDF = async () => {
    setRendering(true);
    try {
      const canvas = renderExportCard({
        content: record?.content || '',
        associations: associations || [],
        externalKnowledge: externalKnowledge || null,
        scope,
        dateStr: getDateStr(),
      });

      const dataUrl = canvas.toDataURL('image/png');
      const { default: jsPDF } = await import('jspdf');

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageW = 210;
      const pageH = 297;
      const marginX = 20;
      const marginY = 15;
      const maxW = pageW - marginX * 2;
      const maxH = pageH - marginY * 2;

      // Scale card to fit A4 within margins
      const cardW = canvas.width;
      const cardH = canvas.height;
      const scale = Math.min(maxW / cardW, maxH / cardH);
      const imgW = cardW * scale;
      const imgH = cardH * scale;
      const x = (pageW - imgW) / 2;
      const y = (pageH - imgH) / 2;

      pdf.addImage(dataUrl, 'PNG', x, y, imgW, imgH);
      pdf.save(getFilename('.pdf'));
      showToast('PDF 已导出');
    } catch (e) {
      console.error('PDF export failed:', e);
      showToast('导出失败：' + (e.message || '请重试'));
    } finally {
      setRendering(false);
      onClose();
    }
  };

  const handleExport = () => {
    try {
      if (format === 'png') {
        exportPNG();
        return;
      }

      if (format === 'pdf') {
        exportPDF();
        return;
      }

      const content = buildTextContent();
      const mimeMap = { md: 'text/markdown', txt: 'text/plain' };
      const extMap = { md: '.md', txt: '.txt' };
      const blob = new Blob([content], { type: mimeMap[format] || 'text/plain' });
      const url = URL.createObjectURL(blob);
      triggerDownload(url, getFilename(extMap[format]));
      URL.revokeObjectURL(url);
      showToast(`已导出 ${formatLabels[format]}`);
      onClose();
    } catch (e) {
      console.error('Export failed:', e);
      showToast('导出失败：' + (e.message || '请重试'));
    }
  };

  return (
    <div className="export-popover" ref={popoverRef} style={{ top: 100, right: 24, maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' }}>
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
        <button className="export-download-btn" onClick={handleExport} disabled={rendering}>
          {rendering ? '渲染中...' : `导出 ${scopeLabels[scope]} · ${formatLabels[format]?.split(' ')[0]}`}
        </button>
      </div>
    </div>
  );
}
