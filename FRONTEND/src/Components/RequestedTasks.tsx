import Modal from "COMPONENTS/Modal";
import type { TaskData } from "QUERIES/tasksGet";
import { useState, type FC } from "react";
import style from "VIEWS/account.module.scss";
import RequestAuditModal from "./RequestAuditModal";
import { useTaskFinalize } from "QUERIES/taskFinalize";
import { useQueryClient } from "@tanstack/react-query";

const renderPrice = (price: string | number, status: string) => {
  if (status === 'finalized') {
    return <span style={{ color: 'red', fontWeight: 700 }}>- {price}</span>;
  }

  return <span>{price}</span>;
};

interface Props {
  accountTasks: TaskData[];
}

const RequestedTasks:FC<Props> = ({
  accountTasks,
}) => {
  const [selectedTaskAddress, setSelectedTaskAddress] = useState<string | null>(null);
  const [selectedRequestAuditAdress, setSelectedRequestAuditAdress] = useState<string | null>(null);

  const taskFinalize = useTaskFinalize();
  const queryClient = useQueryClient();

  const finalize = (address: string) => {
    taskFinalize.mutateAsync(address, {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ['Tasks', 'Account'],
        });
      }
    })
  }

  return (
    <>
      <h4>All requested tasks</h4>
      <div className={style.tableWrapper}>
        <table className={style.table}>
          <thead>
            <tr>
              <th>Address</th>
              <th>Price</th>
              <th>Status</th>
              <th>Created At</th>
              <th>Task info</th>
              <th>Request audit</th>
              <th>Finalize task</th>
            </tr>
          </thead>

          <tbody>
            {accountTasks.map((task) => {
              const date = new Date(task.createdAt)

              const formatted = date.toLocaleString('lv-LV', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })

              return(
                <>
                  <tr key={task.address}>
                    <td>{task.address}</td>
                    <td>{renderPrice(task.price, task.status)}</td>
                    <td>{task.status}</td>
                    <td>{formatted}</td>
                    <td><button
                      key={`info-${task.address}`}
                      onClick={() => setSelectedTaskAddress(task.address)}
                    >
                      Open Info
                    </button></td>
                    <td>
                      { task.status === 'completed' && (
                        <button
                          key={`audit-${task.address}`}
                          onClick={() => setSelectedRequestAuditAdress(task.address)}
                        >
                          Request
                        </button>
                      )}
                    </td>
                    <td>
                      { task.status === 'completed' && (
                        <button
                          key={`finalize-${task.address}`}
                          onClick={() => finalize(task.address)}
                        >
                          Finalize
                        </button>
                      )}
                    </td>
                  </tr>
                </>
              )})}
          </tbody>
        </table>
        {selectedTaskAddress !== null && (
          <Modal
            isOpen={selectedTaskAddress !== null}
            address={selectedTaskAddress ?? ''}
            onClose={() => setSelectedTaskAddress(null)}
          />
        )}

        {selectedRequestAuditAdress !== null && (
          <RequestAuditModal
            isOpen={selectedRequestAuditAdress !== null}
            address={selectedRequestAuditAdress ?? ''}
            onClose={() => setSelectedRequestAuditAdress(null)}
          />
        )}
      </div>
    </>
  );
}

export default RequestedTasks;