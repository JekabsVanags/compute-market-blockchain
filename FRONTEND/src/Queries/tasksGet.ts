import axiosClient from 'CONF/axios';
import { useQuery } from '@tanstack/react-query';

type TaskData = {
  address: string;
  owner: string;
  ownerAccountIndex: number;
  price: string;
  status: string;
  createdAt: string;
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