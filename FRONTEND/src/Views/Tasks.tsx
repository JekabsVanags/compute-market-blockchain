import { useGetTasks } from "QUERIES/tasksGet";
import { useMemo, useState } from "react";

import style from './tasks.module.scss';
import AssignModal from "COMPONENTS/AssignModal";

const Tasks = () => {

  const [selectedTaskAddress, setSelectedTaskAddress] = useState<string | null>(null);
  const {data: tasksData, isLoading: isTasksLoading} = useGetTasks();

  const unassignedTasks = useMemo(() => {
    if (!tasksData) return null

    return [...tasksData.tasks].filter(
      task => task.executorAccountIndex === undefined
    )
  }, [tasksData])

  if ( isTasksLoading || !unassignedTasks || !tasksData) {
    return <div>Loading data</div>
  }

  return (
    <div>
      <h4>{"Legacy task assignment. Use only if auto-assignment returns errors"}</h4>
      <div className={style.tableWrapper}>
        <table className={style.table}>
          <thead>
            <tr>
              <th>Price</th>
              <th>Created At</th>
              <th>Assign</th>
            </tr>
          </thead>

          <tbody>
            {unassignedTasks.map((task) => {
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
                    <td>{task.price}</td>
                    <td>{formatted}</td>
                    <td>
                      <button
                        key={task.address}
                        onClick={() => setSelectedTaskAddress(task.address)}
                      >
                        Assign the task
                      </button>
                    </td>
                  </tr>
                </>
              )})}
          </tbody>
        </table>
      </div>
      {selectedTaskAddress !== null && (
        <AssignModal
          isOpen={selectedTaskAddress !== null}
          address={selectedTaskAddress ?? ''}
          onClose={() => setSelectedTaskAddress(null)}
        />
      )}
    </div>
  )
}

export default Tasks;