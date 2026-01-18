import axiosClient from 'CONF/axios';
import { useQuery } from '@tanstack/react-query';

export type TaskData = {
  address: string;                  // Contract address on blockchain.
  transactionHash: string;          // Deployment transaction hash.
  owner: string;                    // Buyer's wallet address.
  ownerAccountIndex: number;        // Buyer's account index (0–19).
  commandHash: string;              // Hash of the code (stored on-chain).
  price: string;                    // Payment amount in ETH.
  status:
    | 'waiting'
    | 'completed'
    | 'audit_requested'
    | 'audit_passed'
    | 'audit_failed'
    | 'finalized';
  blockNumber: number;              // Block where contract was deployed.
  createdAt: string;                // ISO timestamp when task was created.
  executor?: string;                // Seller's wallet address.
  executorAccountIndex?: number;    // Seller's account index.
  floatingPointStandard?: string;   // E.g., "IEEE 754".
  processingPowerMHz?: number;      // Minimum processing power in MHz.
  memoryGB?: number;                // Minimum memory in GB.
  softwareDependencies?: string[];  // E.g., ["numpy", "pandas"].
  deadline?: string;                // ISO timestamp deadline.
  zipData?: string;                 // Base64-encoded ZIP file of execution artifacts.
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