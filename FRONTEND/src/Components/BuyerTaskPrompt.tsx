import { useQueryClient } from "@tanstack/react-query";
import { useTaskPost } from "QUERIES/taskPost";
import { useState, type FC } from "react";

import style from "VIEWS/account.module.scss";

interface Props {
  id: string;
}

const BuyerTaskPrompt:FC<Props> = ({id}) => {
  const [code, setCode] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [error, setError] = useState<string>("");
  const queryClient = useQueryClient();
  const postTask = useTaskPost(); 
  
  const onTaskPost = async () => {
    setError("");
    await postTask.mutateAsync({
      accountIndex: Number(id),
      code,
      price
    }, {
      onSuccess: async () => {
        queryClient.invalidateQueries({
          queryKey: ['Tasks'],
        });
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
    
  return (
    <>
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
    </>
  )
}

export default BuyerTaskPrompt;