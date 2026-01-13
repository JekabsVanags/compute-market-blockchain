import Modal from "COMPONENTS/Modal";
import type { TaskData } from "QUERIES/tasksGet";
import { useState, type FC } from "react";
import style from "VIEWS/account.module.scss";

interface Props {
  accountTasks: TaskData[];
}

const RequestedTasks:FC<Props> = ({
  accountTasks,
}) => {
  const [selectedTaskAddress, setSelectedTaskAddress] = useState<string | null>(null);

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
              <th>Info</th>
              <th>Result</th>
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
                    <td>{task.price}</td>
                    <td>{task.status}</td>
                    <td>{formatted}</td>
                    <td><button
                      key={task.address}
                      onClick={() => setSelectedTaskAddress(task.address)}
                    >
                      Open Info
                    </button></td>
                    <td>Download button ?</td>
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
      </div>
    </>
  );
}

export default RequestedTasks;