import { useGetAccounts } from "QUERIES/accountsGet";
import { useMemo, useState } from "react";
import { useParams } from "react-router";

import style from './account.module.scss'; 
import { useTaskPost } from "QUERIES/taskPost";
import { useGetTasks } from "QUERIES/tasksGet";
import Modal from "COMPONENTS/Modal";


const Account = () => {
  const { id } = useParams<{ id: string }>()
  const [code, setCode] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [selectedTaskAddress, setSelectedTaskAddress] = useState<string | null>(null)
  const {data: accountData, isLoading} = useGetAccounts();
  const {data: tasksData, isLoading: isTasksLoading} = useGetTasks();

  const postTask = useTaskPost(); 

  const onTaskPost = async () => {
    setError("");
    await postTask.mutateAsync({
      accountIndex: Number(id),
      code,
      price
    }, {
      onSuccess: async () => {
        setCode("");
        setPrice("");
        setSuccessMsg("Task created");
        setTimeout((() => {setSuccessMsg("");}), 5000);
      },
      onError: (error) => {
        console.log("ERROR", error);
        const parsedError = error?.response?.data?.error ?? "Unknown Error";
        setError(parsedError);
      }
    })
  }
  
  const account = useMemo(() => {
    if (!accountData || !id) return null

    const accountIndex = Number(id)
    if (Number.isNaN(accountIndex)) return null

    return accountData.accounts.find(
      (account) => account.index === accountIndex
    ) ?? null
  }, [accountData, id])

  const accountTasks = useMemo(() => {
    if (!tasksData || !id) return null

    const accountIndex = Number(id)
    if (Number.isNaN(accountIndex)) return null

    return tasksData.tasks.filter(
      (task) => task.ownerAccountIndex === accountIndex
    ) ?? null
  }, [tasksData, id])
  

  if (isLoading || !accountData || !account || isTasksLoading || !accountTasks || !tasksData) {
    return <div>Loading data</div>
  }

  console.log("ID", accountTasks);
  
  return (
    <div className={style.root}>
      <div className={style.cardRoot}>
        <div>
          <h3>Your account, id: {id}</h3>
        </div>
        <div>
          <h5>Address: {account.address}</h5>
          <h5>Balance: {account.balance} ETC</h5>
        </div>
      </div>
      <div className={style.cardRoot}>
        <div><h4>Create Task</h4></div>
        <div>
          {error !== "" && (
            <div className={style.errorBox}>
              <span>Error:</span>
              <span>{error}</span>
            </div>
          )}
          {successMsg !== "" && (
            <div className={style.successBox}>
              <span>Success:</span>
              <span>{successMsg}</span>
            </div>
          )}
        </div>
        <div>
          <div>
            <h5>Code:</h5>
            <textarea value={code} rows={20} cols={60} name="code" id="code" onChange={(e) => setCode(e.target.value)}></textarea>
          </div>
          <div>
            <label htmlFor="price" style={{marginRight: 16}}>Price:</label>
            <input value={price} type="text" id="price" name="price" onChange={(e) => setPrice(e.target.value)}/>
          </div>
        </div>
        <div>
          <button 
            type="button" 
            className={style.taskButton}
            onClick={onTaskPost}
          > 
            Submit Task
          </button>
        </div>
      </div>
      <div style={{gridColumn: "span 2"}} className={style.cardRoot}>
        <h4>All the account tasks</h4>
        <div className={style.tableWrapper}>
          <table className={style.table}>
            <thead>
              <tr>
                <th>Address</th>
                <th>Owner</th>
                <th>Price</th>
                <th>Status</th>
                <th>Created At</th>
                <th>Info</th>
                <th>Zip Download ?!?</th>
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
                      <td>{task.owner}</td>
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
          <Modal
            isOpen={selectedTaskAddress !== null}
            address={selectedTaskAddress ?? ''}
            onClose={() => setSelectedTaskAddress(null)}
          />
        </div>
      </div>
    </div>
  )
}

export default Account;