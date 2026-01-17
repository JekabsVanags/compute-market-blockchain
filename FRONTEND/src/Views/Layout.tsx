import { Link, Outlet } from 'react-router-dom'

import styles from './layout.module.scss'


const Layout = ({ isHealthy }: { isHealthy: boolean }) => {
  return (
    <div>
      <div className={styles.nav}>
        <Link to="/"><button>Home</button></Link>
        {isHealthy && (
          <>
            <Link to="/accounts"><button>Accounts</button></Link>
            <Link to="/tasks"><button>Tasks</button></Link>
          </>
        )}
      </div>
      <div className={styles.appLayout}>
        <div className={styles.Content}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export default Layout