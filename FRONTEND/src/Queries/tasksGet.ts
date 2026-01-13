import axiosClient from 'CONF/axios';
import { useQuery } from '@tanstack/react-query';

export type TaskData = {
  address: string;
  owner: string;
  ownerAccountIndex: number;
  price: string;
  status: 'waiting' | 'completed' | 'finalized';
  executor?: string,
  executorAccountIndex?: number,
  createdAt: string;
  completedAt?: string,
  finalizedAt?: string,
}

interface Response {
  tasks: TaskData[]
}

const getTasks = async (): Promise<Response> => {
  const response = await axiosClient.get(`/tasks`);
  return response.data;
};

export const useGetTasks = () =>
  useQuery<Response, Error>({
    queryKey: ['Tasks'],
    queryFn: getTasks,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  })