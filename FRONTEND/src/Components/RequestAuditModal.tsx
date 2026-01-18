import { type FC, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import styles from './modal.module.scss';
import { useRequestAudit } from 'QUERIES/requestAudit';
import { useQueryClient } from '@tanstack/react-query';

interface RequestAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: string;
}

const RequestAuditModal: FC<RequestAuditModalProps> = ({
  isOpen,
  onClose,
  address,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  const requestAudit = useRequestAudit();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async() => {
    if (!reason.trim()) return;


    await requestAudit.mutateAsync({
      address: address,
      data: { reason: reason },
    }, {
      onSuccess: async () => {
        queryClient.invalidateQueries({
          queryKey: ['Tasks'],
        });
        setSuccessMsg(`Audit requested`);
        setTimeout((() => {
          setSuccessMsg("");
          onClose();
        }), 5000);
      },
      onError: (error) => {
        console.log("ERROR", error);
        const parsedError = error?.response?.data?.error ?? "Unknown Error";
        setError(parsedError);
      }
    })

    setReason('');
    onClose();
  };

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3>Request audit</h3>

        {error !== "" && (
          <div className={styles.errorBox} style={{marginBlock: 16}}>
            <span style={{color: "#fff"}}>Error:</span>
            <span style={{color: "#fff"}}>{error}</span>
          </div>
        )}
        {successMsg !== "" && (
          <div className={styles.successBox} style={{marginBlock: 16}}>
            <span style={{color: "#fff"}}>Success:</span>
            <span style={{color: "#fff"}}>{successMsg}</span>
          </div>
        )}
        <div className={styles.content}>
          <label htmlFor="audit-reason">Reason</label>
          <textarea
            id="audit-reason"
            rows={5}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe why the result is incorrect or suspicious"
          />
        </div>

        <div className={styles.actions}>
          <button onClick={onClose}>Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!reason.trim()}
          >
            Submit audit request
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default RequestAuditModal;