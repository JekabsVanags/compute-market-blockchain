import axiosClient from 'CONF/axios';
import { useQuery } from '@tanstack/react-query';

type Blockchain = {
  connected: boolean;
  chainId: string;
  blockNumber: number;
}

export interface HealthData {
  status: string;
  blockchain: Blockchain;
}

const getHealth = async (): Promise<HealthData> => {
  const response = await axiosClient.get(`/health`);
  return response.data;
};

export const useGetHealth = () => useQuery<HealthData, Error>({
  queryKey: ['Health'],
  queryFn: () => getHealth(),
});