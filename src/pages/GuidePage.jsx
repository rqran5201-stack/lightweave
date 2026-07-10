import { useState } from 'react';

const steps = [
  { emoji: '✍️', title: '写下你的想法', desc: '记录你的复盘、日记、思考随笔。不需要整理，写下来就好。' },
  { emoji: '🔗', title: '发现隐藏的关联', desc: '记完一条，系统自动帮你找到和过去的联系。你会发现——原来三个月前你就说过一样的话。' },
  { emoji: '🌱', title: '长出自己的方法论', desc: '当你积累了足够多经验，问答功能可以帮你总结出属于你自己的 SOP。' },
];

export function GuidePage({ onFinish }) {
  const [step, setStep] = useState(0);

  const handleNext = () => {
    if (step >= 2) {
      onFinish();
    } else {
      setStep(step + 1);
    }
  };

  return (
    <div className="page">
      <div className="guide-container">
        <div className="guide-card">
          <div className="guide-illustration">{steps[step].emoji}</div>
          <div className="guide-step-title">{steps[step].title}</div>
          <div className="guide-step-desc">{steps[step].desc}</div>
          {step === 2 && (
            <div style={{ marginTop: 20, padding: '12px 16px', background: '#FFFBF7', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--color-secondary)', lineHeight: 1.7, textAlign: 'left' }}>
              开始使用前，记得在右上角 &#9881; <strong>设置</strong> 里选择模型。<br />
              可使用<strong>免费内置模型</strong>（无需注册），也可以配置自己的 API Key（DeepSeek / OpenAI 等），解锁关联分析与问答功能。
            </div>
          )}
        </div>

        <div className="guide-dots">
          {steps.map((_, i) => (
            <span key={i} className={`guide-dot${i === step ? ' active' : ''}`} />
          ))}
        </div>

        <div className="guide-actions">
          <button className="guide-skip" onClick={onFinish}>跳过</button>
          <button className="btn btn-primary" onClick={handleNext}>
            {step >= 2 ? '开始使用' : '下一步'}
          </button>
        </div>
      </div>
    </div>
  );
}
