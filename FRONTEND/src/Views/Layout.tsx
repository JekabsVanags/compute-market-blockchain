import { Outlet } from 'react-router-dom'

import styles from './layout.module.scss'

const Layout = () => {
  return (
    <div className={styles.appLayout}>
      <div className={styles.Content}>
        <Outlet />
      </div>
    </div>
  )
}

export default Layout