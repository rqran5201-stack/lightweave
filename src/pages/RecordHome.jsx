import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../App';
import { saveRecord, getRecentRecords, searchRecords, getRecordCount, saveAssociation, deleteRecord } from '../store/db';
import { analyzeAssociations } from '../api/deepseek';
import { ImportZone } from '../components/ImportZone';

export function RecordHome({ navigate, apiKeyOk }) {
  const showToast = useToast();
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState('all');
  const [associationState, setAssociationState] = useState('hidden'); // hidden | loading | done | done-empty | error
  const [associationCards, setAssociationCards] = useState([]);
  const [externalCard, setExternalCard] = useState(null);
  const [bannerExpanded, setBannerExpanded] = useState(false);

  const loadRecords = useCallback(async () => {
    if (searchQuery) {
      const results = await searchRecords(searchQuery);
      setRecords(results);
    } else {
      const results = await getRecentRecords(50);
      setRecords(results);
    }
    setLoading(false);
  }, [searchQuery]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const charCount = content.length;
  const canSave = charCount >= 10 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const record = await saveRecord({ content });
      setContent('');
      showToast('记录已保存');
      await loadRecords();

      // Trigger association analysis (engine②)
      setAssociationState('loading');
      setBannerExpanded(false);

      try {
        const allRecords = await getRecentRecords(50);
        const historicalRecords = allRecords.filter(r => r.id !== record.id);
        const result = await analyzeAssociations(record, historicalRecords);

        if (result.associations && result.associations.length > 0) {
          // Map target IDs to full record IDs
          const associations = result.associations.map(a => ({
            ...a,
            // Find the matching historical record by matching the short ID prefix
            sourceRecordId: record.id,
          }));
          await saveAssociation(record.id, associations);
          setAssociationCards(associations);
          setAssociationState('done');
          setFirstAssociationDone(true);
        } else {
          setAssociationState('done-empty');
        }

        if (result.externalKnowledge) {
          setExternalCard(result.externalKnowledge);
        }
      } catch (e) {
        console.error('Association analysis failed:', e);
        setAssociationState('error');
      }
    } catch (e) {
      showToast('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const [showImport, setShowImport] = useState(false);
  const [firstAssociationDone, setFirstAssociationDone] = useState(false);
  const [dataNoticeDismissed, setDataNoticeDismissed] = useState(
    localStorage.getItem('dataNoticeDismissed') === 'true'
  );
  const dismissDataNotice = () => {
    localStorage.setItem('dataNoticeDismissed', 'true');
    setDataNoticeDismissed(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSave();
    }
  };

  const handleImported = useCallback(async (saved) => {
    setShowImport(false);
    await loadRecords();
    if (saved.length === 0) return;

    showToast(`已导入 ${saved.length} 条记录`);

    // Trigger association analysis for imported records
    if (apiKeyOk) {
      setAssociationState('loading');
      setBannerExpanded(false);
      try {
        let allAssociations = [];
        for (const record of saved) {
          const allRecords = await getRecentRecords(50);
          const historicalRecords = allRecords.filter(r => r.id !== record.id);
          if (historicalRecords.length === 0) continue;
          const result = await analyzeAssociations(record, historicalRecords);
          if (result.associations && result.associations.length > 0) {
            const associations = result.associations.map(a => ({ ...a, sourceRecordId: record.id }));
            await saveAssociation(record.id, associations);
            allAssociations = allAssociations.concat(associations);
          }
          if (result.externalKnowledge && !externalCard) {
            setExternalCard(result.externalKnowledge);
          }
        }
        if (allAssociations.length > 0) {
          setAssociationCards(allAssociations);
          setAssociationState('done');
          setFirstAssociationDone(true);
        } else {
          setAssociationState('done-empty');
        }
      } catch (e) {
        console.error('Import association analysis failed:', e);
        setAssociationState('error');
      }
    }
  }, [loadRecords, apiKeyOk, showToast, analyzeAssociations]);

  const filteredRecords = activeTag === 'all'
    ? records
    : records.filter(r => r.tags && r.tags.includes(activeTag));

  const allTags = [...new Set(records.flatMap(r => r.tags || []))];

  // Resolve association target record details
  const resolveTargetRecord = (assoc) => {
    return records.find(r => r.id.slice(0, 8) === assoc.targetRecordId) || null;
  };

  return (
    <div className="page">
      {/* Welcome hint on empty */}
      {records.length === 0 && !loading && (
        <div className="welcome-hint">
          欢迎来到织光 — 写下你的第一条记录，看看你过往的思考里藏着什么
        </div>
      )}

      {/* First association done — natural import nudge */}
      {firstAssociationDone && records.length < 10 && (
        <div className="welcome-hint" style={{ background: '#FFFBF7', color: 'var(--color-secondary)', fontSize: 13 }}>
          发现关联了吗？如果你在其他地方也有记录，<button
            style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-serif)', textDecoration: 'underline' }}
            onClick={() => setShowImport(!showImport)}>点这里导入</button>——记录越多，关联越准
        </div>
      )}

      {/* No API Key configured — guidance */}
      {!apiKeyOk && !loading && (
        <div className="setup-banner">
          <span style={{ fontSize: 20 }}>&#128269;</span>
          <span style={{ flex: 1, fontSize: 14, color: 'var(--color-secondary)' }}>
            配置 API Key 以解锁 AI 关联分析和问答功能
          </span>
          <span style={{ fontSize: 12, color: 'var(--color-tertiary)' }}>
            点击右上角 &#9881; 设置
          </span>
        </div>
      )}

      {/* One-time data storage notice */}
      {!dataNoticeDismissed && records.length >= 1 && (
        <div className="setup-banner" style={{ background: '#FFFBF7' }}>
          <span style={{ fontSize: 20 }}>&#128274;</span>
          <span style={{ flex: 1, fontSize: 14, color: 'var(--color-secondary)' }}>
            你的所有记录只存在于当前浏览器中。清除浏览器数据会丢失。建议定期导出备份。
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={dismissDataNotice}
            style={{ whiteSpace: 'nowrap' }}
          >知道了</button>
        </div>
      )}

      {/* Input Area */}
      <div style={{ marginBottom: 28 }}>
        <textarea
          className="input-area"
          placeholder="此刻想到什么就写下来..."
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, 5000))}
          onKeyDown={handleKeyDown}
        />
        <div className="input-footer">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {charCount > 0 && charCount < 10 && (
              <span style={{ fontSize: 12, color: 'var(--color-tertiary)' }}>还需 {10 - charCount} 字</span>
            )}
            <span className={`char-count${charCount > 5000 ? ' danger' : charCount > 4500 ? ' warn' : ''}`}>
              {Math.min(charCount, 5000)} / 5000
            </span>
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowImport(!showImport)}>
              {showImport ? '收起导入' : '导入'}
            </button>
            <button
              className="btn btn-primary"
              disabled={!canSave}
              onClick={handleSave}
            >
              {saving ? '保存中...' : '记录'}
            </button>
          </div>
        </div>
        {/* Inline import zone, toggled by the import button */}
        {showImport && (
          <div style={{ marginTop: 12 }}>
            <ImportZone onImported={handleImported} />
          </div>
        )}
      </div>

      {/* Association Area */}
      {associationState === 'loading' && (
        <div className="association-banner" style={{ cursor: 'default' }}>
          <div className="spinner" />
          <span style={{ flex: 1, fontSize: 15, color: 'var(--color-secondary)' }}>正在寻找关联...</span>
        </div>
      )}

      {associationState === 'done' && associationCards.length > 0 && (
        <div>
          <div className="association-banner" onClick={() => setBannerExpanded(!bannerExpanded)}>
            <span style={{ fontSize: 20 }}>&#10024;</span>
            <span style={{ flex: 1, fontSize: 15, color: 'var(--color-secondary)' }}>
              发现了 {associationCards.length} 条关联{!bannerExpanded ? ' — 点击展开' : ''}
            </span>
          </div>

          {bannerExpanded && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {associationCards.map((assoc, i) => {
                  const target = resolveTargetRecord(assoc);
                  return (
                    <div key={i} className="card" onClick={() => target && navigate('detail', { id: target.id })}>
                      <div className="card-header">
                        <span className="card-reason">{assoc.category || '关联'}: {assoc.reason?.slice(0, 30)}</span>
                        <span className="card-confidence">
                          <span className={`dot ${assoc.confidence === 'high' ? 'high' : 'medium'}`} />
                          {assoc.confidence === 'high' ? '强关联' : '可能相关'}
                        </span>
                      </div>
                      <div className="card-summary">{assoc.evidence?.slice(0, 200) || assoc.reason}</div>
                      <div className="card-meta">{assoc.targetDate || target ? new Date(target?.createdAt).toLocaleDateString('zh-CN') : ''}</div>
                    </div>
                  );
                })}
              </div>

              {externalCard && (
                <div className="card external" style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 14, color: 'var(--color-tertiary)', marginBottom: 4 }}>外部知识</div>
                  <div className="card-summary">{externalCard.explanation}</div>
                  <div className="card-source">&#128214; {externalCard.source}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {associationState === 'done-empty' && (
        <div className="association-banner" style={{ cursor: 'default' }}>
          <span style={{ fontSize: 20 }}>&#128269;</span>
          <span style={{ flex: 1, fontSize: 15, color: 'var(--color-secondary)' }}>
            这次没有发现强关联，继续记录吧
          </span>
        </div>
      )}

      {associationState === 'error' && (
        <div className="association-banner" style={{ cursor: 'default' }}>
          <span style={{ fontSize: 20 }}>&#9888;</span>
          <span style={{ flex: 1, fontSize: 15, color: 'var(--color-secondary)' }}>
            关联分析暂时不可用
          </span>
          <button className="btn btn-ghost btn-sm" onClick={handleSave}>重试</button>
        </div>
      )}

      {/* Record List */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px 12px' }} className="section-header">
          <span className="section-title">最近记录</span>
          <div className="search-box">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
              <circle cx="7" cy="7" r="4"/><path d="M10 10l3 3" strokeLinecap="round"/>
            </svg>
            <input type="text" placeholder="搜索记录..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>

        {allTags.length > 0 && (
          <div className="tag-chips" style={{ padding: '0 20px 12px' }}>
            <button className={`tag-chip${activeTag === 'all' ? ' active' : ''}`} onClick={() => setActiveTag('all')}>全部</button>
            {allTags.map(tag => (
              <button key={tag} className={`tag-chip${activeTag === tag ? ' active' : ''}`}
                onClick={() => setActiveTag(tag)}>{tag}</button>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '0 20px 20px' }}>
            {[1,2,3,4,5].map(i => <div key={i} className="skeleton skeleton-row" />)}
          </div>
        ) : records.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">&#9997;</div>
            <p>写下你的第一条记录吧</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="empty-state">
            <p>未找到匹配记录</p>
          </div>
        ) : (
          <div>
            {filteredRecords.map(r => (
              <div key={r.id} className="record-row" onClick={() => navigate('detail', { id: r.id })}>
                <span className="record-time">{new Date(r.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}</span>
                <span className="record-summary truncated">{r.summary}</span>
                <span className="record-badge">&#215;{r.associationCount || 0}</span>
                <button
                  className="record-delete-btn"
                  title="删除"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('确定删除这条记录？')) {
                      deleteRecord(r.id).then(() => {
                        showToast('已删除');
                        loadRecords();
                      });
                    }
                  }}
                >&#10005;</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
