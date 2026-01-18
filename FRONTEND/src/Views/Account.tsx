import { useGetAccounts } from "QUERIES/accountsGet";
import { useMemo, useState } from "react";
import { useParams } from "react-router";

import style from './account.module.scss'; 
import { useGetTasks } from "QUERIES/tasksGet";

import BuyerTaskPrompt from "COMPONENTS/BuyerTaskPrompt";
import RequestedTasks from "COMPONENTS/RequestedTasks";
import classNames from "classnames";
import ToDoTasks from "COMPONENTS/ToDoTasks";


const Account = () => {
  const { id } = useParams<{ id: string }>()

  
  const {data: accountData, isLoading} = useGetAccounts();
  const {data: tasksData, isLoading: isTasksLoading} = useGetTasks();
  const [tab, setTab] = useState<'requested' | 'todo'>('requested');
  
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

    return [...tasksData.tasks]
      .filter(task => task.ownerAccountIndex === accountIndex)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      );
  }, [tasksData, id])

  const accountToDoTasks = useMemo(() => {
    if (!tasksData || !id) return null

    const accountIndex = Number(id)
    if (Number.isNaN(accountIndex)) return null

    return [...tasksData.tasks]
      .filter(task => task.executorAccountIndex === accountIndex)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
      )
  }, [tasksData, id])

  if (isLoading || !accountData || !account || isTasksLoading || !accountTasks || !tasksData || !accountToDoTasks) {
    return <div>Loading data</div>
  }

  if (!id) {
    return <div>Cant find account ID</div>
  }
  

  console.log("ID", accountTasks);
  
  return (
    <div>
      <div className={style.root}>
        <div className={style.cardRoot}>
          <div>
            <h3>Your account, id: {id}</h3>
          </div>
          <div>
            <h5>Address: {account.address}</h5>
            <h5>Balance: {account.balance} ETC</h5>
            <h5>Reputation: {account.reputation}</h5>
          </div>
        </div>
        <div className={style.cardRoot}>
          <BuyerTaskPrompt id={id} />
        </div>
      </div>
      <div style={{gridColumn: "span 2"}} className={style.cardRoot}>
        <div className={style.tabButtonWrapper}>
          <button onClick={() => setTab('requested')} className={
            classNames(
              tab !== 'requested' && style.isNotActiveTab
            )
          }>Requested tasks</button>
          <button onClick={() => setTab('todo')} className={
            classNames(
              tab !== 'todo' && style.isNotActiveTab
            )
          }>Assigned tasks</button>
        </div>
        {tab === 'requested' && <RequestedTasks accountTasks={accountTasks} />}
        {tab === 'todo' && <ToDoTasks accountToDoTasks={accountToDoTasks} />}
      </div>
    </div>
  )
}

export default Account;