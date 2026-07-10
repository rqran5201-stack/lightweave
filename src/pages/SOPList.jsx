import { useState, useEffect } from 'react';
import { getAllSOPs } from '../store/db';

export function SOPList({ navigate }) {
  const [sops, setSOPs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const all = await getAllSOPs();
      setSOPs(all.length > 0 ? all : []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="page">
      <h2 style={{ fontSize: 22, marginBottom: 8 }}>SOP 库</h2>
      <p style={{ color: 'var(--color-tertiary)', fontSize: 14, marginBottom: 24 }}>
        从你的记录中孵化出的个人方法论
      </p>

      {loading ? (
        <div>{[1,2].map(i => <div key={i} className="skeleton skeleton-card" />)}</div>
      ) : sops.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">&#128203;</div>
          <p>还没有 SOP</p>
          <p style={{ fontSize: 13, color: 'var(--color-tertiary)', marginTop: 4 }}>
            在问答页向 AI 提问后，点击"生成 SOP"即可将回答提炼为方法步骤
          </p>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 16 }} onClick={() => navigate('qa')}>
            &#128172; 去问答页
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sops.map(sop => (
              <div key={sop.id} className="card" onClick={() => navigate('sopdetail', { id: sop.id })}>
                <h4 style={{ fontSize: 16, marginBottom: 4 }}>&#128203; {sop.title}</h4>
                <div className="card-meta">
                  {sop.steps?.length || sop.stepCount || 0} 个步骤 · 创建于{' '}
                  {new Date(sop.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('qa')}>
              &#10024; 孵化新 SOP
            </button>
          </div>
        </>
      )}
    </div>
  );
}
