import { useState, useEffect, useRef } from 'react';
import { useToast } from '../App';
import { getRecord, deleteRecord, getAssociation, getBacklinks, getRecentRecords, saveAssociation } from '../store/db';
import { analyzeAssociations } from '../api/deepseek';
import { ExportPopover } from '../components/ExportPopover';

export function RecordDetail({ id, navigate, showConfirm }) {
  const showToast = useToast();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [associations, setAssociations] = useState([]);
  const [backlinks, setBacklinks] = useState([]);
  const [externalKnowledge, setExternalKnowledge] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const analyzedRef = useRef(null);

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return; }
    (async () => {
      const r = await getRecord(id);
      if (!r) { setNotFound(true); setLoading(false); return; }
      setRecord(r);

      const assoc = await getAssociation(id);
      if (assoc?.associations) setAssociations(assoc.associations);
      if (assoc?.externalKnowledge) setExternalKnowledge(assoc.externalKnowledge);

      const bl = await getBacklinks(id);
      setBacklinks(bl);
      setLoading(false);

      // Lazy analysis: if no cached associations and not already analyzing for this record
      if ((!assoc?.associations || assoc.associations.length === 0) && analyzedRef.current !== id) {
        analyzedRef.current = id;
        setAnalyzing(true);
        try {
          const allRecords = await getRecentRecords(50);
          const otherRecords = allRecords.filter(r2 => r2.id !== id);
          if (otherRecords.length > 0) {
            const result = await analyzeAssociations(r, otherRecords);
            if (result.associations && result.associations.length > 0) {
              const mapped = result.associations.map(a => ({ ...a, sourceRecordId: id }));
              await saveAssociation(id, mapped);
              setAssociations(mapped);
            }
            if (result.externalKnowledge) {
              setExternalKnowledge(result.externalKnowledge);
            }
          }
        } catch (e) {
          console.error('Lazy association analysis failed:', e);
        } finally {
          setAnalyzing(false);
        }
      }
    })();
  }, [id]);

  const handleDelete = () => {
    showConfirm({
      title: '删除这条记录？',
      message: '删除后不可恢复。',
      confirmLabel: '删除',
      confirmClass: 'btn btn-primary btn-sm',
      confirmStyle: { background: 'var(--color-error)' },
      onConfirm: async () => {
        await deleteRecord(id);
        showToast('已删除');
        navigate('home');
      },
    });
  };

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton" style={{ width: 80, height: 18, marginBottom: 20 }} />
        <div className="skeleton" style={{ height: 200, marginBottom: 32 }} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-icon">&#128533;</div>
          <p>记录不存在</p>
          <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => navigate('home')}>
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Back button */}
      <button className="detail-back" onClick={() => navigate('home')}>&larr; 返回</button>

      {/* Header */}
      <div className="detail-header">
        <div className="detail-time">{new Date(record.createdAt).toLocaleString('zh-CN')}</div>
        {record.tags && record.tags.length > 0 && (
          <div className="tag-chips">
            {record.tags.map(tag => <span key={tag} className="tag-chip active">{tag}</span>)}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="detail-body">{record.content}</div>

      {/* Association Cards */}
      {analyzing && (
        <div className="association-banner" style={{ cursor: 'default', marginBottom: 12 }}>
          <div className="spinner" />
          <span style={{ flex: 1, fontSize: 15, color: 'var(--color-secondary)' }}>正在寻找关联...</span>
        </div>
      )}

      {associations.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          <div style={{ fontSize: 14, color: 'var(--color-tertiary)', marginBottom: 4 }}>关联发现</div>
          {associations.map((assoc, i) => (
            <div key={i} className="card" onClick={() => navigate('detail', { id: assoc.targetRecordId || assoc.sourceRecordId })}>
              <div className="card-header">
                <span className="card-reason">{assoc.category || '关联'}: {assoc.reason?.slice(0, 30)}</span>
                <span className="card-confidence">
                  <span className={`dot ${assoc.confidence === 'high' ? 'high' : 'medium'}`} />
                  {assoc.confidence === 'high' ? '强关联' : '可能相关'}
                </span>
              </div>
              <div className="card-summary">{assoc.evidence?.slice(0, 200) || assoc.reason}</div>
              <div className="card-meta">{assoc.targetDate}</div>
            </div>
          ))}
        </div>
      )}

      {/* External Knowledge */}
      {externalKnowledge && (
        <div className="card external" style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, color: 'var(--color-tertiary)', marginBottom: 4 }}>外部知识</div>
          <div className="card-summary">{externalKnowledge.explanation}</div>
          <div className="card-source">&#128214; {externalKnowledge.source}</div>
          <div style={{ fontSize: 12, color: 'var(--color-tertiary)', marginTop: 8 }}>AI 生成，请核实来源</div>
        </div>
      )}

      {/* Bidirectional Links */}
      {backlinks.length > 0 && (
        <div className="bidirectional-section">
          <h3>被以下记录关联</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {backlinks.map((bl, i) => (
              <a key={i} href="#" onClick={(e) => { e.preventDefault(); navigate('detail', { id: bl.sourceRecordId }); }}
                style={{ color: 'var(--color-primary)', fontSize: 14 }}>
                {bl.reason?.slice(0, 60)} &rarr;
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <div className="export-btn-wrapper">
          <button className="btn btn-ghost btn-sm" onClick={() => setShowExport(!showExport)}>导出</button>
          {showExport && (
            <ExportPopover
              context="record"
              record={record}
              associations={associations}
              externalKnowledge={externalKnowledge}
              onClose={() => setShowExport(false)}
            />
          )}
        </div>
        <button className="btn btn-danger btn-sm" onClick={handleDelete}>删除这条记录</button>
      </div>
    </div>
  );
}
