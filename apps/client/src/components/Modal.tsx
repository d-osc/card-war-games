import { ReactNode, useEffect } from 'react';
import Icon from './Icon';

interface Props {
  title?: string;
  onClose?: () => void;
  children: ReactNode;
  dismissable?: boolean;
  wide?: boolean;
}

export default function Modal({ title, onClose, children, dismissable = true, wide = false }: Props) {
  useEffect(() => {
    if (!dismissable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismissable, onClose]);

  return (
    <div className="modal-overlay" onClick={() => dismissable && onClose?.()}>
      <div className="modal-shell">
        {onClose && dismissable && (
          <button className="modal-close" onClick={onClose} title="ปิด" aria-label="ปิด">
            <Icon name="cancel" size={16} />
          </button>
        )}
        <div className={`modal${wide ? ' wide' : ''}`} onClick={(e) => e.stopPropagation()}>
          {title && <h3>{title}</h3>}
          {children}
        </div>
      </div>
    </div>
  );
}
