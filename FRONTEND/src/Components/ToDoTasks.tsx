import type { TaskData } from "QUERIES/tasksGet";
import { useState, type FC } from "react";
import style from "VIEWS/account.module.scss";
import SubmitResultModal from "./SubmitResultModal";

interface Props {
  accountToDoTasks: TaskData[];
}

const ToDoTasks:FC<Props> = ({
  accountToDoTasks,
}) => {
  const [selectedTaskAddress, setSelectedTaskAddress] = useState<string | null>(null);

  return (
    <>
      <h4>All assigned tasks</h4>
      <div className={style.tableWrapper}>
        <table className={style.table}>
          <thead>
            <tr>
              <th>Address</th>
              <th>Price</th>
              <th>Status</th>
              <th>Created At</th>
              <th>Submit result</th>
            </tr>
          </thead>

          <tbody>
            {accountToDoTasks.map((task) => {
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
                    <td>
                      { 'waiting' === task.status ? (
                        <button
                          key={task.address}
                          onClick={() => setSelectedTaskAddress(task.address)}
                        >
                          Send result of the task
                        </button>
                      ) : (
                        <span>
                          Result already submited
                        </span>
                      )
                      }
                    </td>
                  </tr>
                </>
              )})}
          </tbody>
        </table>
        {selectedTaskAddress !== null && (
          <SubmitResultModal
            isOpen={selectedTaskAddress !== null}
            address={selectedTaskAddress ?? ''}
            onClose={() => setSelectedTaskAddress(null)}
          />
        )}
      </div>
    </>
  );
}

export default ToDoTasks;