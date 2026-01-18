import { useMutation } from '@tanstack/react-query';
import type { AxiosError } from 'axios';

import axiosClient from 'CONF/axios';
import type { TaskData } from './tasksGet';

export interface TaskPostData {
  accountIndex: number;
  code: string;
  price: string;
  floatingPointStandard?: string;   // E.g., "IEEE 754".
  processingPowerMHz?: number;      // Minimum processing power in MHz.
  memoryGB?: number;                // Minimum memory in GB.
  softwareDependencies?: string[];  // E.g., ["numpy", "pandas"].
  deadline?: string;                // ISO timestamp deadline for completion.
}

export interface ApiErrorResponse {
  error: string;
  details?: string;
}

export interface CreateTaskResponse {
  task: TaskData;
}

const requestAudit = async (address: string, data: {reason: string}) => {
  const response = await axiosClient.post(`/tasks/${address}/request-audit`, data);
  return response.data;
};

export const useRequestAudit = () =>
  useMutation<
    void,        
    AxiosError<ApiErrorResponse>,  
    { address: string; data: {reason: string} } 
  >({
    mutationFn: ({ address, data }) => requestAudit(address, data),
  })
