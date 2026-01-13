import { useMutation } from '@tanstack/react-query';
import type { AxiosError } from 'axios';

import axiosClient from 'CONF/axios';

export interface TaskAssignData{
  accountIndex: number;
}

export interface ApiErrorResponse {
  error: string
  details: string
}

const assignTask = async (address: string, data: TaskAssignData) => {
  const response = await axiosClient.post(`/tasks/${address}/assign`, data);
  return response.data;
};

export const useTaskAssing = () =>
  useMutation<
    void,        
    AxiosError<ApiErrorResponse>,  
    { address: string; data: TaskAssignData } 
  >({
    mutationFn: ({ address, data }) => assignTask(address, data),
  })
