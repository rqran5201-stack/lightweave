import { useState, useEffect } from 'react';
import { getAllAssociations, getRecord } from '../store/db';

export function Discovery({ navigate }) {
  const [tab, setTab] = useState('recent');
  const [associations, setAssociations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const all = await getAllAssociations();
      // Flatten and enrich with source record info
      const enriched = [];
      for (const entry of all) {
        const sourceRecord = await getRecord(entry.recordId);
        if (!sourceRecord) continue;
        if (entry.associations) {
          for (const assoc of entry.associations) {
            enriched.push({
              ...assoc,
              sourceRecordId: entry.recordId,
              sourceRecordSummary: sourceRecord.summary,
              sourceDate: new Date(sourceRecord.createdAt).toLocaleDateString('zh-CN'),
              createdAt: entry.createdAt,
            });
          }
        }
      }
      enriched.sort((a, b) => b.createdAt - a.createdAt);
      setAssociations(enriched);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="page">
      <h2 style={{ fontSize: 22, marginBottom: 24 }}>发现</h2>

      <div className="page-tabs">
        <button className={`page-tab${tab === 'recent' ? ' active' : ''}`} onClick={() => setTab('recent')}>最近关联</button>
        <button className={`page-tab${tab === 'weekly' ? ' active' : ''}`} onClick={() => setTab('weekly')}>周度洞察</button>
      </div>

      {tab === 'recent' && (
        loading ? (
          <div>{[1,2,3].map(i => <div key={i} className="skeleton skeleton-card" />)}</div>
        ) : associations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">&#128270;</div>
            <p>记录多了，关联发现就多了</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {associations.map((assoc, i) => (
              <div key={i} className="card" onClick={() => navigate('detail', { id: assoc.sourceRecordId })}>
                <div className="card-header">
                  <span className="card-reason">{assoc.category || '关联'}: {assoc.reason?.slice(0, 30)}</span>
                  <span className="card-confidence">
                    <span className={`dot ${assoc.confidence === 'high' ? 'high' : 'medium'}`} />
                    {assoc.confidence === 'high' ? '强关联' : '可能相关'}
                  </span>
                </div>
                <div className="card-summary">{assoc.sourceRecordSummary}</div>
                <div className="card-meta">关联时间：{assoc.sourceDate}</div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'weekly' && (
        <div>
          <div className="insight-card">
            <h4>&#128197; 本周认知洞察</h4>
            <div style={{ marginBottom: 10, fontSize: 14, color: 'var(--color-secondary)' }}>本周高频关键词</div>
            <div className="insight-keywords">
              <span className="insight-keyword">自我反思</span>
              <span className="insight-keyword">行动方法</span>
              <span className="insight-keyword">沟通表达</span>
            </div>
            <div className="insight-mood">
              &#127786; 继续记录，积累更多数据后这里会显示你的认知趋势。
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => alert('周度洞察需要至少一周的记录数据')}>
              &#128260; 重新生成
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
