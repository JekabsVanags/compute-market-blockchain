import { type FC, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import styles from './modal.module.scss';
import { useGetTaskAddress } from 'QUERIES/taskAddressGet';
import { downloadZip } from 'CONF/DownloadZipHelper';

const formatDate = (dateString?: string) => {
  if (!dateString) return null;

  const date = new Date(dateString);
  return date.toLocaleString('lv-LV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const Field: FC<{ label: string; value?: string | number | null }> = ({ label, value }) => {
  if (value === undefined || value === null || value === '') return null;

  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}: </span>
      <span className={styles.value}>{value}</span>
    </div>
  );
};

const Section: FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className={styles.section}>
    <h4>{title}</h4>
    {children}
  </div>
);

type OutputTab = 'code' | 'stdout' | 'stderr';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: string;
}

const Modal: FC<ModalProps> = ({ isOpen, onClose, address }) => {
  const { data, isLoading } = useGetTaskAddress(address, {
    enabled: isOpen && !!address,
  });

  const [activeTab, setActiveTab] = useState<OutputTab>();

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

  const task = data?.task;

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className={styles.content}>
          {isLoading && <div>Loading data…</div>}

          {!isLoading && task && (
            <>
              <h3>Task details</h3>

              <Section title="General">
                <Field label="Address" value={task.address} />
                <Field label="Transaction hash" value={task.transactionHash} />
                <Field label="Status" value={task.status} />
                <Field label="Price (ETH)" value={task.price} />
                <Field label="Block number" value={task.blockNumber} />
                <Field label="Created at" value={formatDate(task.createdAt)} />
                <Field label="Completed at" value={formatDate(task.completedAt)} />
                <Field label="Finalized at" value={formatDate(task.finalizedAt)} />
              </Section>

              <Section title="Buyer">
                <Field label="Owner" value={task.owner} />
                <Field
                  label="Owner account index"
                  value={task.ownerAccountIndex}
                />
              </Section>

              <Section title="Execution">
                <Field label="Executor" value={task.executor} />
                <Field
                  label="Executor account index"
                  value={task.executorAccountIndex}
                />
                <Field label="Command hash" value={task.commandHash} />
                <Field label="Stdout" value={task.stdout} />
                <Field label="Stderr" value={task.stderr} />
              </Section>

              <Section title="Requirements">
                <Field
                  label="Floating point standard"
                  value={task.floatingPointStandard}
                />
                <Field
                  label="Processing power (MHz)"
                  value={task.processingPowerMHz}
                />
                <Field label="Memory (GB)" value={task.memoryGB} />
                <Field
                  label="Software dependencies"
                  value={task.softwareDependencies?.join(', ')}
                />
                <Field label="Deadline" value={formatDate(task.deadline)} />
              </Section>

              <Section title="Audit">
                <Field label="Audit reason" value={task.auditReason} />
                <Field
                  label="Audit requested at"
                  value={formatDate(task.auditRequestedAt)}
                />
                <Field label="Auditor" value={task.auditor} />
                <Field
                  label="Auditor account index"
                  value={task.auditorAccountIndex}
                />
                <Field label="Audit result" value={task.auditorResult} />
                <Field
                  label="Audit completed at"
                  value={formatDate(task.auditCompletedAt)}
                />
              </Section>
              <div className={styles.tabs}>
                <button
                  className={activeTab === 'code' ? styles.activeTab : ''}
                  onClick={() => setActiveTab('code')}
                >
                  Code
                </button>

                {task.stdout && (
                  <button
                    className={activeTab === 'stdout' ? styles.activeTab : ''}
                    onClick={() => setActiveTab('stdout')}
                  >
                    Stdout
                  </button>
                )}

                {task.stderr && (
                  <button
                    className={activeTab === 'stderr' ? styles.activeTab : ''}
                    onClick={() => setActiveTab('stderr')}
                  >
                    Stderr
                  </button>
                )}
              </div>
              <div className={styles.tabContent}>
                {activeTab === 'code' && (
                  <pre className={styles.codeBlock}>{task.code}</pre>
                )}

                {activeTab === 'stdout' && task.stdout && (
                  <pre className={styles.outputBlock}>{task.stdout}</pre>
                )}

                {activeTab === 'stderr' && task.stderr && (
                  <pre className={styles.errorBlock}>{task.stderr}</pre>
                )}

                {task.zipData && (
                  <button
                    className={styles.downloadButton}
                    onClick={() => {
                      if (!task.zipData) return;
                      downloadZip(task.zipData, `task-${task.address}.zip`);
                    }}
                  >
                    Download execution artifacts
                  </button>
                )}
              </div>

              {task.exitCode !== undefined && (
                <Field label="Exit code" value={task.exitCode} />
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;