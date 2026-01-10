import { useGetAccounts } from "QUERIES/accountsGet";
import { useState } from "react";
import { Link } from "react-router";


const Accounts = () => {
  const [account, setAccount] = useState<string>("");
  const {data: accountData, isLoading} = useGetAccounts();
  
  if (isLoading || !accountData) {
    return <div>d</div>
  }
  
  return (
    <div>
      <div>
        <h3>Select Account</h3>
      </div>
      <div>
        <select
          value={account}
          onChange={(e) => setAccount(e.target.value)}
        >
          <option value="" disabled>
            Select chain
          </option>

          {accountData.accounts.map((account) => (
            <option key={account.address} value={account.index}>
              {account.address}
            </option>
          ))}
        </select>
      </div>
      <div>
        {account !== "" && (
          <Link to={`/account/${account}`}>Go to account</Link>
        )}
      </div>
    </div>
  )
}

export default Accounts;