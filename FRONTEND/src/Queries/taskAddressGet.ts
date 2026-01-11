import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'

import axiosClient from 'CONF/axios'

export interface TaskAddressData {
  address: string
  transactionHash: string
  owner: string
  ownerAccountIndex: number
  code: string
  commandHash: string
  price: string
  status: string
  blockNumber: string
  createdAt: string
}

interface TaskAddressResponse {
  task: TaskAddressData
}

const getTaskAddress = async (
  address: string
): Promise<TaskAddressResponse> => {
  const response = await axiosClient.get(`/tasks/${address}`)
  return response.data
}

interface UseGetTaskAddressOptions {
  enabled?: boolean
}

export const useGetTaskAddress = (
  address: string,
  options?: UseGetTaskAddressOptions
) =>
  useQuery<
    TaskAddressResponse,
    AxiosError
  >({
    queryKey: ['taskAddress', address],
    queryFn: () => getTaskAddress(address),
    enabled: options?.enabled && !!address,
  })