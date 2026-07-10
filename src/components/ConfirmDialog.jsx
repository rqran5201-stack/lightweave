export function ConfirmDialog({ title, message, confirmLabel = '确认', confirmClass = 'btn btn-primary btn-sm', confirmStyle = {}, onConfirm, onClose }) {
  return (
    <div className="confirm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
        <h4>{title}</h4>
        <p>{message}</p>
        <div className="confirm-actions">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>取消</button>
          <button className={confirmClass} style={confirmStyle}
            onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
