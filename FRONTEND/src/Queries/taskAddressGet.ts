import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'

import axiosClient from 'CONF/axios'

export interface TaskAddressData {
  address: string;                  // Contract address on blockchain.
  transactionHash: string;          // Deployment transaction hash.
  owner: string;                    // Buyer's wallet address.
  ownerAccountIndex: number;        // Buyer's account index (0-19).
  code: string;                     // Python code to execute.
  commandHash: string;              // Hash of the code (stored on-chain).
  price: string;                    // Payment amount in ETH.

  // Computational requirements (optional - from proposal):
  floatingPointStandard?: string;   // E.g., "IEEE 754".
  processingPowerMHz?: number;      // Minimum processing power in MHz.
  memoryGB?: number;                // Minimum memory in GB.
  softwareDependencies?: string[];  // E.g., ["numpy", "pandas"].
  deadline?: string;                // ISO timestamp deadline for completion.
  status: 'waiting' | 'completed' | 'audit_requested' | 'audit_passed' | 'audit_failed' | 'finalized';
  executor?: string;                // Seller's wallet address (set when completed).
  executorAccountIndex?: number;    // Seller's account index (set when completed).
  result?: string;                  // Computation result (set when completed) - legacy format (replaced by structured output below).
  paymentTransactionHash?: string;  // Payment transaction hash (set when finalized).

  // Structured execution output - new format (for better frontend display):
  stdout?: string;                  // Standard output from code execution.
  stderr?: string;                  // Standard error from code execution.
  exitCode?: number;                // Exit code from code execution.
  zipData?: string;                 // Base64-encoded ZIP file of execution artifacts.
  blockNumber: number;              // Block where contract was deployed.
  createdAt: string;                // ISO timestamp when task was created.
  completedAt?: string;             // ISO timestamp when seller completed task.
  finalizedAt?: string;             // ISO timestamp when buyer finalized task.

  // Audit fields - only populated if audit is requested:
  auditReason?: string;             // Reason buyer requested audit.
  auditRequestedAt?: string;        // ISO timestamp when audit was requested.
  auditor?: string;                 // Auditor's wallet address (set when audit result submitted).
  auditorAccountIndex?: number;     // Auditor's account index (0-19).
  auditorResult?: string;           // Auditor's computation result.
  auditCompletedAt?: string;        // ISO timestamp when audit was completed.
  auditorZipData?: string;          // Auditor's ZIP data (base64).
}

interface TaskAddressResponse {
  task: TaskAddressData
}

const getTaskAddress = async (
  address: string
): Promise<TaskAddressResponse> => {
  const response = await axiosClient.get(`/tasks/${address}`)
  return response.data
}

interface UseGetTaskAddressOptions {
  enabled?: boolean
}

export const useGetTaskAddress = (
  address: string,
  options?: UseGetTaskAddressOptions
) =>
  useQuery<
    TaskAddressResponse,
    AxiosError
  >({
    queryKey: ['taskAddress', address],
    queryFn: () => getTaskAddress(address),
    enabled: options?.enabled && !!address,
  })