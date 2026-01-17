import { type FC, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import styles from './modal.module.scss'
import { useGetTaskAddress } from 'QUERIES/taskAddressGet'
import { useQueryClient } from '@tanstack/react-query'
import { useTaskResult } from 'QUERIES/taskComplete'

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
  isOpen: boolean
  onClose: () => void
  address: string
}

const SubmitResultModal: FC<Props> = ({ isOpen, onClose, address }) => {
  const { data, isLoading } = useGetTaskAddress(address, {
    enabled: isOpen && !!address,
  })

  const [error, setError] = useState<string>("");
  const [result, setResult] = useState("");
  const [successMsg, setSuccessMsg] = useState<string>("");
  const queryClient = useQueryClient();
  const taskResult = useTaskResult(); 

  const onTaskPost = async () => {
    setError("");

    if(!address || !data?.task.executorAccountIndex || result === "") {
      setError("Account ID or result or adress should be set");
      return;
    }

    await taskResult.mutateAsync({
      address: address,
      data: { 
        accountIndex: Number(data?.task.executorAccountIndex),
        result: result
      },
    }, {
      onSuccess: async () => {
        queryClient.invalidateQueries({
          queryKey: ['Tasks'],
        });
        setSuccessMsg("Result submitted successfully");
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
              <h3>Sent the result of the task</h3>
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
              <div>
                <span style={{fontWeight: 600}}>Address: </span>
                <span>{data.task.address}</span>
              </div>
              <div>
                <span style={{fontWeight: 600}}>Transaction Hash: </span>
                <span>{data.task.transactionHash}</span>
              </div>
              <div>
                <span style={{fontWeight: 600}}>Command Hash: </span>
                <span>{data.task.commandHash}</span>
              </div>
              <div>
                <span style={{fontWeight: 600}}>Price: </span>
                <span>{data.task.price}</span>
              </div>
              <div>
                <span style={{fontWeight: 600}}>Status: </span>
                <span>{data.task.status}</span>
              </div>
              <div>
                <span style={{fontWeight: 600}}>Block number: </span>
                <span>{data.task.blockNumber}</span>
              </div>
              <div>
                <span style={{fontWeight: 600}}>Created At: </span>
                <span>{formatDate(data.task.createdAt)}</span>
              </div>
              <div>
                <p style={{fontWeight: 600}}>Code: </p>
                <p>{data.task.code}{data.task.code}</p>
              </div>
              <div>
                <p style={{fontWeight: 600}}>Submit result: </p>
                <div>
                  <h5>Result:</h5>
                  <textarea value={result} rows={20} cols={60} name="code" id="code" onChange={(e) => setResult(e.target.value)}></textarea>
                </div>
              </div>
              <div>
                <button 
                  type="button" 
                  onClick={onTaskPost}
                > 
                  Submit Result
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default SubmitResultModal