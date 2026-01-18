import { useQueryClient } from "@tanstack/react-query";
import { useTaskPost } from "QUERIES/taskPost";
import { useState, type FC } from "react";

import style from "VIEWS/account.module.scss";

interface Props {
  id: string;
}

const BuyerTaskPrompt: FC<Props> = ({ id }) => {
  const [code, setCode] = useState("");
  const [price, setPrice] = useState("");

  const [floatingPointStandard, setFloatingPointStandard] = useState("");
  const [processingPowerMHz, setProcessingPowerMHz] = useState("");
  const [memoryGB, setMemoryGB] = useState("");
  const [softwareDependencies, setSoftwareDependencies] = useState("");
  const [deadline, setDeadline] = useState("");

  const [successMsg, setSuccessMsg] = useState("");
  const [error, setError] = useState("");

  const queryClient = useQueryClient();
  const postTask = useTaskPost();

  const onTaskPost = async () => {
    setError("");
    await postTask.mutateAsync({
      accountIndex: Number(id),
      code,
      price,
      floatingPointStandard: floatingPointStandard || undefined,
      processingPowerMHz: processingPowerMHz
        ? Number(processingPowerMHz)
        : undefined,
      memoryGB: memoryGB ? Number(memoryGB) : undefined,
      softwareDependencies: softwareDependencies
        ? softwareDependencies.split(",").map(d => d.trim())
        : undefined,
      deadline: deadline || undefined,
    }, {
      onSuccess: async () => {
        queryClient.invalidateQueries({
          queryKey: ['Tasks'],
        });
        
        //reset fields
        setCode("");
        setPrice("");
        setFloatingPointStandard("");
        setProcessingPowerMHz("");
        setMemoryGB("");
        setSoftwareDependencies("");
        setDeadline("");
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
        {error && (
          <div className={style.errorBox}>
            <span>Error:</span>
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className={style.successBox}>
            <span>Success:</span>
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      <div>
        <div className={style.inputMargin}>
          <h5>Code:</h5>
          <textarea
            value={code}
            rows={20}
            cols={60}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>

        <div className={style.inputMargin}>
          <label style={{marginRight: 8}}>Price:</label>
          <input
            value={price}
            type="text"
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>

        <div className={style.inputMargin}>
          <label style={{marginRight: 8}}>Floating-point standard:</label>
          <input
            value={floatingPointStandard}
            type="text"
            placeholder="IEEE 754"
            onChange={(e) => setFloatingPointStandard(e.target.value)}
          />
        </div>

        <div className={style.inputMargin}>
          <label style={{marginRight: 8}}>Processing power (MHz):</label>
          <input
            value={processingPowerMHz}
            type="number"
            onChange={(e) => setProcessingPowerMHz(e.target.value)}
          />
        </div>

        <div className={style.inputMargin}>
          <label style={{marginRight: 8}}>Memory (GB):</label>
          <input
            value={memoryGB}
            type="number"
            onChange={(e) => setMemoryGB(e.target.value)}
          />
        </div>

        <div className={style.inputMargin}>
          <label style={{marginRight: 8}}>Software dependencies:</label>
          <input
            value={softwareDependencies}
            type="text"
            placeholder="numpy, pandas"
            onChange={(e) => setSoftwareDependencies(e.target.value)}
          />
        </div>

        <div className={style.inputMargin}>
          <label style={{marginRight: 8}}>Deadline:</label>
          <input
            value={deadline}
            type="datetime-local"
            onChange={(e) => setDeadline(e.target.value)}
          />
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
  );
};

export default BuyerTaskPrompt;