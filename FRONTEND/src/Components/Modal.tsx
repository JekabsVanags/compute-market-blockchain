import { type FC, useEffect } from 'react'
import { createPortal } from 'react-dom'

import styles from './modal.module.scss'
import { useGetTaskAddress } from 'QUERIES/taskAddressGet'

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

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  address: string
}

const Modal: FC<ModalProps> = ({ isOpen, onClose, address }) => {
  const { data, isLoading } = useGetTaskAddress(address, {
    enabled: isOpen && !!address,
  })

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
              <h3>Task</h3>
              <div>
                <span style={{fontWeight: 600}}>Address: </span>
                <span>{data.task.address}</span>
              </div>
              <div>
                <span style={{fontWeight: 600}}>Transaction Hash: </span>
                <span>{data.task.transactionHash}</span>
              </div>
              <div>
                <span style={{fontWeight: 600}}>Owner: </span>
                <span>{data.task.owner}</span>
              </div>
              <div>
                <span style={{fontWeight: 600}}>Owner account index: </span>
                <span>{data.task.ownerAccountIndex}</span>
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

export default Modal