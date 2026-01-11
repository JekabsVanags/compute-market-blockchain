import { useGetHealth } from 'QUERIES/healthGet'
import React, { Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from 'VIEWS/Layout'

const Home = React.lazy(() => import('VIEWS/Home'))
const Accounts = React.lazy(() => import('VIEWS/Accounts'))
const Account = React.lazy(() => import('VIEWS/Account'))

const Router = () => {
  const { data: healthData, isLoading } = useGetHealth()

  if (isLoading || !healthData) {
    return <div>Checking system health…</div>
  }

  const isHealthy = healthData.status !== 'error' 

  return (
    <Suspense fallback={<div>Loading page…</div>}>
      <Routes>
        {/* 👇 Layout wrapper */}
        <Route element={<Layout isHealthy={isHealthy} />}>
          <Route path="/" element={<Home healthData={healthData} isHealthy={isHealthy} />} />

          {isHealthy && (
            <>
              <Route path="/accounts" element={<Accounts/>} />
              <Route path="/account/:id" element={<Account/>} />
              {/* <Route path="/dashboard" element={<Dashboard />} /> */}
              {/* more routes */}
            </>
          )}

          {!isHealthy && (
            <Route path="*" element={<Navigate to="/" replace />} />
          )}
        </Route>
      </Routes>
    </Suspense>
  )
}

export default Router