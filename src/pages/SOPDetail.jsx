import { useState, useEffect } from 'react';
import { useToast } from '../App';
import { getSOP, deleteSOP, saveSOP } from '../store/db';
import { ExportPopover } from '../components/ExportPopover';

export function SOPDetail({ id, navigate, showConfirm }) {
  const showToast = useToast();
  const [sop, setSOP] = useState(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const s = await getSOP(id);
      if (s) {
        setSOP(s);
        setTitle(s.title);
      }
      setLoading(false);
    })();
  }, [id]);

  const handleDelete = () => {
    showConfirm({
      title: '删除这个 SOP？',
      message: '删除后不可恢复。',
      confirmLabel: '删除',
      confirmClass: 'btn btn-primary btn-sm',
      confirmStyle: { background: 'var(--color-error)' },
      onConfirm: async () => {
        await deleteSOP(sop.id);
        showToast('已删除');
        navigate('sop');
      },
    });
  };

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 300 }} />
      </div>
    );
  }

  if (!sop) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-icon">&#128533;</div>
          <p>SOP 不存在</p>
          <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => navigate('sop')}>
            返回 SOP 库
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <button className="detail-back" onClick={() => navigate('sop')}>&larr; 返回 SOP 库</button>

      <div className="sop-detail-header">
        <input
          className="sop-detail-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={(e) => e.target.style.borderBottomColor = 'var(--color-primary)'}
          onBlur={async (e) => {
            e.target.style.borderBottomColor = 'transparent';
            if (title.trim() && title !== sop.title) {
              const updated = { ...sop, title: title.trim() };
              await saveSOP(updated);
              setSOP(updated);
              showToast('标题已更新');
            }
          }}
        />
        <div className="sop-detail-meta">
          {sop.steps?.length || sop.stepCount} 个步骤 · 基于 {sop.recordCount || 5} 条相关记录 · 创建于{' '}
          {new Date(sop.createdAt).toLocaleDateString('zh-CN')}
        </div>
      </div>

      <div className="sop-steps">
        {(sop.steps || []).map((step, i) => (
          <div key={i} className="sop-step">
            <div className="sop-step-num">{step.stepNumber || i + 1}</div>
            <div className="sop-step-content">
              <div className="sop-step-title">{step.title}</div>
              <div className="sop-step-desc">{step.description}</div>
              <span className="sop-step-source">&#128221; 来源：{step.sourceDate} &rarr;</span>
            </div>
          </div>
        ))}
      </div>

      <div className="sop-detail-actions">
        <button className="btn btn-danger btn-sm" onClick={handleDelete}>删除此 SOP</button>
        <div className="export-btn-wrapper">
          <button className="btn btn-ghost btn-sm" onClick={() => setShowExport(!showExport)}>导出</button>
          {showExport && (
            <ExportPopover context="sop" record={{ content: sop.title }} onClose={() => setShowExport(false)} />
          )}
        </div>
      </div>
    </div>
  );
}
