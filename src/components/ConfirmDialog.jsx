export function ConfirmDialog({ title, message, confirmLabel = '确认', confirmClass = 'btn btn-primary btn-sm', confirmStyle = {}, cancelLabel = '取消', onConfirm, onCancel, onClose }) {
  const handleCancel = () => {
    if (onCancel) onCancel();
    onClose();
  };

  return (
    <div className="confirm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
        <h4>{title}</h4>
        <p style={{ whiteSpace: 'pre-wrap' }}>{message}</p>
        <div className="confirm-actions">
          <button className="btn btn-ghost btn-sm" onClick={handleCancel}>{cancelLabel}</button>
          <button className={confirmClass} style={confirmStyle}
            onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
