import { useMutation } from '@tanstack/react-query';
import type { AxiosError } from 'axios';

import axiosClient from 'CONF/axios';

export interface TaskPostData{
  accountIndex: number;
  code: string;
  price: string;
}

export interface ApiErrorResponse {
  error: string
  details: string
}

const postTask = async (data: TaskPostData) => {
  const response = await axiosClient.post('/tasks', data);
  return response.data;
};

export const useTaskPost = () =>
  useMutation<
    void,        
    AxiosError<ApiErrorResponse>,  
    TaskPostData 
  >({
    mutationFn: postTask,
  })
