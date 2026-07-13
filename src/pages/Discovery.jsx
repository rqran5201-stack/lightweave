import { useState, useEffect } from 'react';
import { getAllAssociations, getRecord, getAllRecords, saveWeeklyInsight, getWeeklyInsight } from '../store/db';
import { generateWeeklyInsight } from '../api/deepseek';
import { isLlmConfigured } from '../api/models';

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function getWeekRange(weekStart) {
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = d => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${fmt(start)} - ${fmt(end)}`;
}

export function Discovery({ navigate }) {
  const [tab, setTab] = useState('recent');
  const [associations, setAssociations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Weekly insight state
  const [weeklyInsight, setWeeklyInsight] = useState(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyError, setWeeklyError] = useState('');

  useEffect(() => {
    (async () => {
      const all = await getAllAssociations();
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

  const loadWeeklyInsight = async (forceRegenerate = false) => {
    const weekStart = getWeekStart();
    const configured = isLlmConfigured();

    // Check cache first (unless forcing regenerate)
    if (!forceRegenerate) {
      const cached = await getWeeklyInsight(weekStart);
      if (cached) {
        setWeeklyInsight(cached);
        return;
      }
    }

    // Get this week's records
    const allRecords = await getAllRecords();
    const weekStartMs = new Date(weekStart).getTime();
    const weekEndMs = weekStartMs + 7 * 24 * 60 * 60 * 1000;
    const weekRecords = allRecords.filter(r => {
      const ts = r.createdAt;
      return ts >= weekStartMs && ts < weekEndMs;
    });

    if (weekRecords.length < 3) {
      setWeeklyInsight({ _empty: true, count: weekRecords.length });
      return;
    }

    if (!configured) {
      setWeeklyError('请先在设置中配置 LLM');
      return;
    }

    setWeeklyLoading(true);
    setWeeklyError('');

    try {
      const historicalRecords = allRecords.filter(r => {
        const ts = r.createdAt;
        return ts < weekStartMs;
      });

      const insight = await generateWeeklyInsight(weekRecords, historicalRecords);
      const saved = await saveWeeklyInsight({ ...insight, weekStart });
      setWeeklyInsight(saved);
    } catch (err) {
      setWeeklyError(err.message || '生成失败，请重试');
    } finally {
      setWeeklyLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'weekly' && !weeklyInsight && !weeklyLoading) {
      loadWeeklyInsight();
    }
  }, [tab]);

  const weekStart = getWeekStart();

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
          {weeklyLoading ? (
            <div className="insight-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div className="spinner" style={{ margin: '0 auto 16px' }} />
              <p style={{ color: 'var(--color-secondary)', fontSize: 15 }}>正在生成本周洞察...</p>
              <p style={{ color: 'var(--color-tertiary)', fontSize: 13, marginTop: 6 }}>AI 正在阅读你的本周记录</p>
            </div>
          ) : weeklyError ? (
            <div className="insight-card" style={{ textAlign: 'center', padding: '36px 24px' }}>
              <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.6 }}>&#9888;</div>
              <p style={{ color: 'var(--color-error)', fontSize: 15, marginBottom: 16 }}>{weeklyError}</p>
              <button className="btn btn-ghost btn-sm" onClick={() => loadWeeklyInsight(true)}>重试</button>
            </div>
          ) : weeklyInsight?._empty ? (
            <div className="insight-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.6 }}>&#128221;</div>
              <h4 style={{ marginBottom: 8 }}>本周记录还不够</h4>
              <p style={{ color: 'var(--color-secondary)', fontSize: 15, lineHeight: 1.8 }}>
                本周已有 <strong>{weeklyInsight.count}</strong> 条记录，至少需要 3 条才能生成周度洞察。
                <br />再多写几笔，下周这个时候就能看到你的认知趋势了。
              </p>
            </div>
          ) : weeklyInsight ? (
            <>
              <div className="insight-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h4 style={{ marginBottom: 0 }}>&#128197; {getWeekRange(weekStart)} 认知洞察</h4>
                  <span style={{ fontSize: 12, color: 'var(--color-tertiary)' }}>
                    {new Date(weeklyInsight.generatedAt).toLocaleDateString('zh-CN')} 生成
                  </span>
                </div>

                {/* Summary */}
                {weeklyInsight.summary && (
                  <div className="insight-mood" style={{ marginBottom: 16, fontSize: 15, lineHeight: 1.8 }}>
                    {weeklyInsight.summary}
                  </div>
                )}

                {/* Keywords */}
                {weeklyInsight.keywords?.length > 0 && (
                  <>
                    <div style={{ fontSize: 13, color: 'var(--color-tertiary)', marginBottom: 10 }}>本周高频关键词</div>
                    <div className="insight-keywords">
                      {weeklyInsight.keywords.map((kw, i) => (
                        <span key={i} className="insight-keyword">{kw}</span>
                      ))}
                    </div>
                  </>
                )}

                {/* Mood Trend */}
                {weeklyInsight.moodTrend && (
                  <div style={{ marginTop: 16, padding: '14px 16px', background: 'var(--color-insight-highlight-bg)', borderRadius: 'var(--radius-md)', fontSize: 14, color: 'var(--color-secondary)', lineHeight: 1.7 }}>
                    &#127786; {weeklyInsight.moodTrend}
                  </div>
                )}
              </div>

              {/* Highlights */}
              {weeklyInsight.highlights?.length > 0 && (
                <div className="insight-card">
                  <h4 style={{ marginBottom: 14 }}>&#128161; 与过去的呼应</h4>
                  {weeklyInsight.highlights.map((hl, i) => (
                    <div
                      key={i}
                      className="insight-highlight"
                      style={{ cursor: hl.recordId ? 'pointer' : 'default' }}
                      onClick={() => {
                        if (hl.recordId) navigate('detail', { id: hl.recordId });
                      }}
                    >
                      <div style={{ fontSize: 14, color: 'var(--color-on-surface)', lineHeight: 1.7, marginBottom: 4 }}>
                        {hl.reason}
                      </div>
                      {hl.recordDate && (
                        <div style={{ fontSize: 12, color: 'var(--color-tertiary)' }}>{hl.recordDate}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => loadWeeklyInsight(true)} disabled={weeklyLoading}>
                  &#128260; 重新生成
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
