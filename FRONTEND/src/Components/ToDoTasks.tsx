import type { TaskData } from "QUERIES/tasksGet";
import { useState, type FC } from "react";
import style from "VIEWS/account.module.scss";
import Modal from "./Modal";

const renderPrice = (price: string | number, status: string) => {
  if (status === 'finalized') {
    return <span style={{ color: '#008000', fontWeight: 700 }}>+ {price}</span>;
  }

  return <span>{price}</span>;
};

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
              <th>Task info</th>
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
                    <td>{renderPrice(task.price, task.status)}</td>
                    <td>{task.status}</td>
                    <td>{formatted}</td>
                    <td><button
                      key={task.address}
                      onClick={() => setSelectedTaskAddress(task.address)}
                    >
                      Open Info
                    </button></td>
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

export default ToDoTasks;