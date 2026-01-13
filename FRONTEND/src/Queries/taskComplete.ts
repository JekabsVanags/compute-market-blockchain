import { useMutation } from '@tanstack/react-query';
import type { AxiosError } from 'axios';

import axiosClient from 'CONF/axios';

export interface TaskAssignData{
  accountIndex: number;
  result: string;
}

export interface ApiErrorResponse {
  error: string
  details: string
}

const resultTask = async (address: string, data: TaskAssignData) => {
  const response = await axiosClient.post(`/tasks/${address}/complete`, data);
  return response.data;
};

export const useTaskResult = () =>
  useMutation<
    void,        
    AxiosError<ApiErrorResponse>,  
    { address: string; data: TaskAssignData } 
  >({
    mutationFn: ({ address, data }) => resultTask(address, data),
  })
