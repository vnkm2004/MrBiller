import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'warning' | 'info';
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'warning',
}: ConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          className={`p-3 rounded-full ${
            variant === 'warning' ? 'bg-amber-500/10 text-amber-500' : 'bg-accent2/10 text-accent2'
          }`}
        >
          <AlertTriangle size={32} />
        </div>
        <p className="text-secondary text-sm leading-relaxed">{message}</p>
        <div className="flex gap-3 w-full mt-2">
          <button className="btn-secondary flex-1" onClick={onClose}>
            {cancelLabel || t('common.cancel')}
          </button>
          <button className="btn-primary flex-1" onClick={onConfirm}>
            {confirmLabel || t('common.confirm')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
