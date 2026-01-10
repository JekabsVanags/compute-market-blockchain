import { useGetAccounts } from "QUERIES/accountsGet";
import { useMemo, useState } from "react";
import { useParams } from "react-router";

import style from './account.module.scss'; 
import { useTaskPost } from "QUERIES/taskPost";


const Account = () => {
  const { id } = useParams<{ id: string }>()
  const [code, setCode] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [error, setError] = useState<string>("");
  const {data: accountData, isLoading} = useGetAccounts();

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
        // setTimeout((() => {setError("");}), 5000);
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
  

  if (isLoading || !accountData || !account) {
    return <div>d</div>
  }

  console.log("ID", account);
  
  return (
    <div className={style.root}>
      <div>
        <div>
          <h3>Your account, id: {id}</h3>
        </div>
        <div>
          <h5>Address: {account.address}</h5>
          <h5>Balance: {account.balance} ETC</h5>
        </div>
      </div>
      <div>
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
      <div>
        <h4>All the account tasks</h4>
      </div>
    </div>
  )
}

export default Account;