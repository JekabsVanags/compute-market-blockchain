import { useMutation } from '@tanstack/react-query';
import type { AxiosError } from 'axios';

import axiosClient from 'CONF/axios';
import type { TaskData } from './tasksGet';

export interface ApiErrorResponse {
  error: string;
  details?: string;
}

export interface FinalizeTaskResponse {
  task: TaskData;
}

const taskFinalize = async (address: string): Promise<FinalizeTaskResponse> => {
  const response = await axiosClient.post(`/tasks/${address}/finalize`);
  return response.data;
};

export const useTaskFinalize = () =>
  useMutation<
    FinalizeTaskResponse,        
    AxiosError<ApiErrorResponse>,
    string                       
  >({
    mutationFn: taskFinalize,
  });