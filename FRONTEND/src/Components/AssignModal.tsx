import { type FC, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import styles from './modal.module.scss'
import { useGetTaskAddress } from 'QUERIES/taskAddressGet'

import { useQueryClient } from '@tanstack/react-query'
import { useTaskAssing } from 'QUERIES/taskAssign'

const formatDate = (dateString: string) => {
  const date = new Date(dateString)

  return date.toLocaleString('lv-LV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  address: string
}

const AssignModal: FC<Props> = ({ isOpen, onClose, address }) => {

  const { data, isLoading } = useGetTaskAddress(address || "", {
    enabled: isOpen && !!address,
  })

  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");
  const queryClient = useQueryClient();
  const assignTask = useTaskAssing(); 

  const onTaskPost = async () => {
    setError("");

    if(!accountId || accountId === "") {
      setError("Account ID should be set");
      return;
    }

    await assignTask.mutateAsync({
      address: address,
      data: { accountIndex: Number(accountId) },
    }, {
      onSuccess: async () => {
        queryClient.invalidateQueries({
          queryKey: ['Tasks'],
        });
        setSuccessMsg(`Assigned task for account index: ${accountId}`);
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
  }

  useEffect(() => {
    if (!isOpen) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

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
          {!isLoading && data?.task && (
            <>
              <h3>Assign the task</h3>
              <div>
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
                <span style={{fontWeight: 600}}>Account Index: </span>
                <input 
                  style={{
                    backgroundColor: '#fff',
                    color: '#000'
                  }} 
                  type="number" 
                  id='id' 
                  name='id' 
                  onChange={(e) => setAccountId(e.target.value)} />
              </div>
              <div>
                <span style={{fontWeight: 600}}>Address: </span>
                <span>{address}</span>
              </div>
              <div>
                <span style={{fontWeight: 600}}>Created At: </span>
                <span>{formatDate(data.task.createdAt)}</span>
              </div>
              <div>
                <span style={{fontWeight: 600}}>Accept and assign task: </span>
                <button 
                  type="button" 
                  className={styles.taskButton}
                  onClick={onTaskPost}
                > 
                  Assign task
                </button>
              </div>
              <div>
                <p style={{fontWeight: 600}}>Requested code: </p>
                <p>{data.task.code}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default AssignModal