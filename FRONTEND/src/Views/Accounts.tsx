import { useGetAccounts } from 'QUERIES/accountsGet';
import { Link } from 'react-router';
import styles from './accounts.module.scss';

const Accounts = () => {
  const { data: accountData, isLoading } = useGetAccounts();

  if (isLoading || !accountData) {
    return <div>Loading accounts…</div>;
  }

  return (
    <div>
      <h3>Select Account</h3>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Address</th>
            <th>Balance (ETH)</th>
            <th>Reputation</th>
            <th />
          </tr>
        </thead>

        <tbody>
          {accountData.accounts.map((account) => (
            <tr key={account.address}>
              <td className={styles.mono}>{account.address}</td>
              <td>{account.balance}</td>
              <td>{account.reputation}</td>
              <td>
                <Link
                  to={`/account/${account.index}`}
                  className={styles.selectButton}
                >
                  Select account
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Accounts;