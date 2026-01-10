import axiosClient from 'CONF/axios';
import { useQuery } from '@tanstack/react-query';


export interface AccountData {
  index: number;
  address: string;
  balance: string;
}

interface Response {
  accounts: AccountData[]
}

const getAccounts = async (): Promise<Response> => {
  const response = await axiosClient.get(`/accounts`);
  return response.data;
};

export const useGetAccounts = () => useQuery<Response, Error>({
  queryKey: ['Accounts'],
  queryFn: () => getAccounts(),
});