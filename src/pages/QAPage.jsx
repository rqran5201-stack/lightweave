import { useState, useEffect, useRef } from 'react';
import { useToast } from '../App';
import { getQAHistory, saveQAMessage, deleteQAMessage, getRecentRecords, saveSOP, getAllSOPs, getAllRecordsWithEmbeddings } from '../store/db';
import { answerQuestion, generateSOP } from '../api/deepseek';
import { generateEmbedding, findRelevantRecords } from '../api/embedding';

/**
 * Group consecutive user+assistant messages into "topics" for folding.
 * Each topic = one user question + its AI answer (if exists).
 */
function groupMessagesIntoTopics(messages) {
  const topics = [];
  let currentTopic = null;

  for (const msg of messages) {
    if (msg.role === 'user') {
      if (currentTopic) topics.push(currentTopic);
      currentTopic = {
        id: msg.id,
        question: msg.content.slice(0, 60),
        fullQuestion: msg.content,
        messages: [msg],
        createdAt: msg.createdAt,
      };
    } else if (currentTopic) {
      currentTopic.messages.push(msg);
    } else {
      // orphan answer — create a placeholder topic
      currentTopic = {
        id: msg.id,
        question: '(回答)',
        fullQuestion: '',
        messages: [msg],
        createdAt: msg.createdAt,
      };
    }
  }
  if (currentTopic) topics.push(currentTopic);
  return topics;
}

export function QAPage({ navigate, apiKeyOk }) {
  const showToast = useToast();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const [generatingSOP, setGeneratingSOP] = useState(null);
  const [collapsedTopics, setCollapsedTopics] = useState({});
  const [recordCount, setRecordCount] = useState(0);

  // Scroll management
  const scrollContainerRef = useRef(null);
  const skipAutoScroll = useRef(false);

  useEffect(() => {
    (async () => {
      const history = await getQAHistory();
      const records = await getRecentRecords(50);
      setRecordCount(records.length);
      setMessages(history);
      setInitialized(true);
    })();
  }, []);

  // Smart auto-scroll: only scroll when user is near the bottom of the chat area
  useEffect(() => {
    if (skipAutoScroll.current) {
      skipAutoScroll.current = false;
      return;
    }
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 120;

    if (isNearBottom || loading) {
      // Small delay to let DOM render, then scroll
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    if (!apiKeyOk) {
      showToast('请先在设置中配置 LLM');
      return;
    }

    const userMsg = { id: crypto.randomUUID(), role: 'user', content: input.trim(), createdAt: Date.now() };
    setMessages(m => [...m, userMsg]);
    await saveQAMessage(userMsg);
    setInput('');
    setLoading(true);

    try {
      let records;
      const allWithEmb = await getAllRecordsWithEmbeddings();
      setRecordCount(allWithEmb.length);
      try {
        const qEmb = await generateEmbedding(input);
        records = findRelevantRecords(qEmb, allWithEmb, 30);
        if (records.length < 3) records = allWithEmb.slice(-30);
      } catch {
        records = await getRecentRecords(50);
      }
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
      let records;
      const allWithEmb = await getAllRecordsWithEmbeddings();
      try {
        const qEmb = await generateEmbedding(question);
        records = findRelevantRecords(qEmb, allWithEmb, 30);
        if (records.length < 3) records = allWithEmb.slice(-30);
      } catch {
        records = await getRecentRecords(50);
      }

      // Dedup: check existing SOPs with similar titles
      const existingSOPs = await getAllSOPs();
      const questionKey = question.slice(0, 30).toLowerCase();
      const existing = existingSOPs.find(s =>
        s.title && s.title.toLowerCase().includes(questionKey.slice(0, 10))
      );
      if (existing) {
        showToast(`已有相关 SOP「${existing.title}」，将基于新内容更新`);
      }

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

  const handleDeleteMsg = async (msgId) => {
    skipAutoScroll.current = true;
    await deleteQAMessage(msgId);
    setMessages(m => m.filter(x => x.id !== msgId));
  };

  const suggestedQuestions = [
    '我最近在纠结什么？',
    '我有什么重复出现的模式？',
    '关于沟通表达，我的经验可以总结成什么方法？',
  ];

  const topics = groupMessagesIntoTopics(messages);
  const hasTopics = topics.length > 0;

  return (
    <div className="page">
      <h2 style={{ fontSize: 22, marginBottom: 8 }}>问答</h2>
      <p style={{ color: 'var(--color-tertiary)', fontSize: 14, marginBottom: 24 }}>
        基于你的所有记录作答，每条回答附引用来源
      </p>

      {/* Empty records guidance */}
      {recordCount === 0 && initialized && (
        <div className="setup-banner" style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 20 }}>&#128218;</span>
          <span style={{ flex: 1, fontSize: 14, color: 'var(--color-secondary)' }}>
            你还没有记录。建议先<button
              style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: 14, fontFamily: 'var(--font-serif)', textDecoration: 'underline' }}
              onClick={() => navigate('home')}
            >写几条记录</button>，这样 AI 才能基于你的内容作答。直接提问也行——但只能基于通用知识回答。
          </span>
        </div>
      )}

      {/* Chat area */}
      <div
        className="qa-scroll-area"
        ref={scrollContainerRef}
        style={{
          maxHeight: hasTopics ? 'calc(100vh - 360px)' : 'none',
          overflowY: hasTopics ? 'auto' : 'visible',
          paddingRight: 4,
          marginBottom: hasTopics ? 20 : 0,
          scrollBehavior: 'auto',
        }}
      >
        {!hasTopics ? (
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
          /* Topic-grouped view with folding */
          topics.length <= 3 ? (
            /* Few topics — show flat */
            messages.map((msg, i) => {
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
                    onClick={() => handleDeleteMsg(msg.id)}
                  >&#10005;</button>
                </div>
              );
            })
          ) : (
            /* Many topics — show grouped with topic headers */
            topics.map((topic, ti) => (
              <div key={topic.id} className="qa-topic-group">
                <div
                  className="qa-topic-header"
                  onClick={() => setCollapsedTopics(c => ({ ...c, [topic.id]: !c[topic.id] }))}
                >
                  <span className="qa-topic-arrow">{collapsedTopics[topic.id] ? '&#9654;' : '&#9660;'}</span>
                  <span className="qa-topic-title">{topic.question}</span>
                  <span className="qa-topic-meta">
                    {new Date(topic.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                {!collapsedTopics[topic.id] && (
                  <div className="qa-topic-body">
                    {topic.messages.map((msg, i) => {
                      const question = msg.role === 'assistant' ? (topic.messages[i - 1]?.content || '') : '';
                      return (
                        <div key={msg.id} className="qa-message-wrapper">
                          {msg.role === 'user' ? (
                            <div className="qa-message-user">{msg.content}</div>
                          ) : (
                            <div className="qa-message-ai" style={{ marginBottom: 12 }}>
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
                            onClick={() => handleDeleteMsg(msg.id)}
                          >&#10005;</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )
        )}
      </div>

      <div className="qa-input-row">
        <textarea
          placeholder={recordCount === 0 ? '没有记录时，AI 只能基于通用知识回答。建议先去首页写几条...' : '基于你的记录提问...'}
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
