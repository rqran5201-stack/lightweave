import { useState, useEffect, useRef } from 'react';
import { useToast } from '../App';
import { getQAHistory, saveQAMessage, deleteQAMessage, getRecentRecords, saveSOP } from '../store/db';
import { answerQuestion, generateSOP } from '../api/deepseek';

export function QAPage({ navigate, apiKeyOk }) {
  const showToast = useToast();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const [generatingSOP, setGeneratingSOP] = useState(null); // msg id being generated
  const messagesEndRef = useRef(null);

  useEffect(() => {
    (async () => {
      const history = await getQAHistory();
      setMessages(history);
      setInitialized(true);
    })();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    if (!apiKeyOk) {
      showToast('请先在设置中配置 API Key');
      return;
    }

    const userMsg = { id: crypto.randomUUID(), role: 'user', content: input.trim(), createdAt: Date.now() };
    setMessages(m => [...m, userMsg]);
    await saveQAMessage(userMsg);
    setInput('');
    setLoading(true);

    try {
      const records = await getRecentRecords(50);
      const conversationHistory = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

      const aiMsg = { id: crypto.randomUUID(), role: 'assistant', content: '', createdAt: Date.now() };
      setMessages(m => [...m, aiMsg]);

      let fullContent = '';
      for await (const chunk of answerQuestion(input, records, conversationHistory)) {
        fullContent += chunk;
        setMessages(m => {
          const copy = [...m];
          copy[copy.length - 1] = { ...copy[copy.length - 1], content: fullContent };
          return copy;
        });
      }

      if (!fullContent) {
        setMessages(m => m.filter(x => x.id !== aiMsg.id));
        showToast('未收到回复，请检查 API Key 或重试');
        return;
      }

      await saveQAMessage({ ...aiMsg, content: fullContent });
    } catch (e) {
      showToast(e.message || '问答请求失败');
      setMessages(m => m.filter(x => x.id !== (m[m.length - 1]?.id)));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleGenerateSOP = async (msgId, question) => {
    setGeneratingSOP(msgId);
    try {
      const records = await getRecentRecords(50);
      const sop = await generateSOP(question, records);
      const saved = await saveSOP(sop);
      showToast('SOP 已生成');
      navigate('sopdetail', { id: saved.id });
    } catch (e) {
      showToast('SOP 生成失败：' + (e.message || '未知错误'));
    } finally {
      setGeneratingSOP(null);
    }
  };

  const suggestedQuestions = [
    '我最近在纠结什么？',
    '我有什么重复出现的模式？',
    '关于沟通表达，我的经验可以总结成什么方法？',
  ];

  return (
    <div className="page">
      <h2 style={{ fontSize: 22, marginBottom: 8 }}>问答</h2>
      <p style={{ color: 'var(--color-tertiary)', fontSize: 14, marginBottom: 24 }}>
        基于你的所有记录作答，每条回答附引用来源
      </p>

      {messages.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">&#128172;</div>
          <p>基于你的记录，问我任何问题</p>
          <div className="suggested-questions">
            {suggestedQuestions.map((q, i) => (
              <button key={i} className="suggested-q" onClick={() => { setInput(q); }}>
                {q}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 24 }}>
          {messages.map((msg, i) => {
            const question = msg.role === 'assistant' ? (messages[i - 1]?.content || '') : '';
            return (
            <div key={msg.id} className="qa-message-wrapper">
              {msg.role === 'user' ? (
                <div className="qa-message-user">{msg.content}</div>
              ) : (
                <div className="qa-message-ai" style={{ marginBottom: 16 }}>
                  {msg.content ? (
                    collapsed[msg.id] ? (
                      <div>
                        <div className="qa-collapsed-preview">{msg.content.slice(0, 80)}{msg.content.length > 80 ? '...' : ''}</div>
                        <button className="qa-collapse-toggle" onClick={() => setCollapsed(c => ({ ...c, [msg.id]: false }))}>
                          展开回答 &#9660;
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                        <div className="qa-answer-footer">
                          <button className="qa-collapse-toggle" onClick={() => setCollapsed(c => ({ ...c, [msg.id]: true }))}>
                            收起回答 &#9650;
                          </button>
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={generatingSOP === msg.id}
                            onClick={() => handleGenerateSOP(msg.id, question)}
                          >
                            {generatingSOP === msg.id ? '生成中...' : '生成 SOP'}
                          </button>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="spinner" />
                  )}
                </div>
              )}
              <button
                className="qa-delete-btn"
                title="删除"
                onClick={async () => {
                  await deleteQAMessage(msg.id);
                  setMessages(m => m.filter(x => x.id !== msg.id));
                }}
              >&#10005;</button>
            </div>
          );
          })}
          <div ref={messagesEndRef} />
        </div>
      )}

      <div className="qa-input-row">
        <textarea
          placeholder="基于你的记录提问..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button className="btn btn-primary" onClick={handleSend} disabled={loading || !input.trim()}>
          {loading ? '思考中...' : '发送'}
        </button>
      </div>
      <p style={{ fontSize: 13, color: 'var(--color-tertiary)', marginTop: 8 }}>
        提示：试试问"我的哪些记录之间有矛盾""关于XX主题我积累了什么"
      </p>
    </div>
  );
}
