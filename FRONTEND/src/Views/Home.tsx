import { type HealthData } from "QUERIES/healthGet";
import type { FC } from "react";

import styles from './home.module.scss'
import classNames from "classnames";
import { Link } from "react-router";

interface HomeProps{
  healthData: HealthData;
  isHealthy: boolean;
}

const Home:FC<HomeProps> = ({healthData, isHealthy}) => {  
  return (
    <div className={styles.root}>
      <div>
        <h3>{"Blockchain Health Status"}</h3>
      </div>
      <div className={classNames(
        styles.statusBar,
        isHealthy && styles.success,
        !isHealthy && styles.error,
      )}>
      </div>
      <div>
        <ul className={styles.list}>
          <li>{`Status: ${healthData.status}`}</li>
          <li>{`Connected: ${healthData.blockchain.connected}`}</li>
          {isHealthy && (
            <>
              <li>{`chainId: ${healthData.blockchain.chainId}`}</li>
              <li>{`blockNumber: ${healthData.blockchain.blockNumber}`}</li>
            </>
          )}
        </ul>
      </div>
      <div>
        {isHealthy && (
          <Link to="/accounts">{"Accounts ->"}</Link>
        )}
      </div>
    </div>
  )
}

export default Home;