import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';

// ====== Toast Context ======
const ToastContext = createContext();
export function useToast() { return useContext(ToastContext); }

// ====== App ======
import { RecordHome } from './pages/RecordHome';
import { RecordDetail } from './pages/RecordDetail';
import { Discovery } from './pages/Discovery';
import { QAPage } from './pages/QAPage';
import { SOPList } from './pages/SOPList';
import { SOPDetail } from './pages/SOPDetail';
import { GuidePage } from './pages/GuidePage';
import { SettingsModal } from './components/SettingsModal';
import { ConfirmDialog } from './components/ConfirmDialog';

function App() {
  const [page, setPage] = useState('home');
  const [pageParams, setPageParams] = useState({});
  const [toasts, setToasts] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [apiKeyOk, setApiKeyOk] = useState(false);

  useEffect(() => {
    const key = localStorage.getItem('llm_api_key') || localStorage.getItem('deepseek_api_key');
    setApiKeyOk(!!key);
    // Check if first visit
    if (!localStorage.getItem('guideCompleted')) {
      setPage('guide');
    }
  }, []);

  const navigate = useCallback((p, params = {}) => {
    setPage(p);
    setPageParams(params);
    window.scrollTo(0, 0);
  }, []);

  const showToast = useCallback((msg) => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  }, []);

  const showConfirm = useCallback((opts) => {
    setConfirm(opts);
  }, []);

  const getNavClass = (p) => {
    if (p === page) return 'topnav-link active';
    if (p === 'sop' && page === 'sopdetail') return 'topnav-link active';
    return 'topnav-link';
  };

  const handleSettingsSaved = (key) => {
    setApiKeyOk(!!key);
    setSettingsOpen(false);
    showToast('API Key 已保存');
  };

  return (
    <ToastContext.Provider value={showToast}>
      {/* Top Nav */}
      <nav className="topnav">
        <div className="topnav-brand" onClick={() => navigate('home')}>
          <svg viewBox="0 0 28 28" fill="none" width="28" height="28">
            <circle cx="14" cy="14" r="12" stroke="#C77D5A" strokeWidth="1.5" opacity="0.5"/>
            <circle cx="14" cy="14" r="5" fill="#C77D5A" opacity="0.8"/>
            <path d="M14 2v4M14 22v4M2 14h4M22 14h4" stroke="#C77D5A" strokeWidth="1" opacity="0.4" strokeLinecap="round"/>
          </svg>
          织光
        </div>
        <div className="topnav-links">
          <button className={getNavClass('home')} onClick={() => navigate('home')} title="记录">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
              <path d="M5 3h5l7 7-7 7H5V3z" strokeLinejoin="round"/>
              <line x1="8" y1="7" x2="13" y2="7"/><line x1="8" y1="10" x2="13" y2="10"/><line x1="8" y1="13" x2="11" y2="13"/>
            </svg>
          </button>
          <button className={getNavClass('discovery')} onClick={() => navigate('discovery')} title="发现">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
              <circle cx="9" cy="9" r="5"/><path d="M13 13l4 4" strokeLinecap="round"/>
            </svg>
          </button>
          <button className={getNavClass('qa')} onClick={() => navigate('qa')} title="问答">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
              <circle cx="10" cy="10" r="7"/><path d="M8 8h4M8 11h2" strokeLinecap="round"/>
            </svg>
          </button>
          <button className={getNavClass('sop')} onClick={() => navigate('sop')} title="SOP">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
              <rect x="3" y="2" width="14" height="16" rx="2"/>
              <line x1="7" y1="7" x2="13" y2="7"/><line x1="7" y1="10" x2="13" y2="10"/><line x1="7" y1="13" x2="10" y2="13"/>
            </svg>
          </button>
        </div>
        <button className="topnav-gear" onClick={() => setSettingsOpen(true)} title="设置">&#9881;</button>
      </nav>

      {/* Toast container */}
      <div className="toast-container">
        {toasts.map(t => <div key={t.id} className="toast">{t.msg}</div>)}
      </div>

      {/* Pages */}
      {page === 'guide' && <GuidePage onFinish={() => { localStorage.setItem('guideCompleted', 'true'); navigate('home'); }} />}
      {page === 'home' && <RecordHome navigate={navigate} apiKeyOk={apiKeyOk} />}
      {page === 'detail' && <RecordDetail id={pageParams.id} navigate={navigate} showConfirm={showConfirm} />}
      {page === 'discovery' && <Discovery navigate={navigate} />}
      {page === 'qa' && <QAPage navigate={navigate} apiKeyOk={apiKeyOk} />}
      {page === 'sop' && <SOPList navigate={navigate} />}
      {page === 'sopdetail' && <SOPDetail id={pageParams.id} navigate={navigate} showConfirm={showConfirm} />}

      {/* Modals */}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} onSaved={handleSettingsSaved} />}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </ToastContext.Provider>
  );
}

export default App;
