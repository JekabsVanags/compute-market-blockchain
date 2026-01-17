#!/usr/bin/env ts-node

/**
 * Executor Client for Compute Market
 *
 * This client polls the API server for tasks assigned to a specific executor address,
 * executes the Python code via the executor daemon, and submits the results back.
 * The account index is automatically determined by querying the API for the list of accounts.
 *
 * Usage: npm start <executor_address>
 * Example: npm start 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
 */

import * as net from 'net';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const SOCKET_PATH = '/tmp/executor_daemon.sock';
const POLL_INTERVAL = 5000; // Poll every 5 seconds

interface Task {
  address: string;
  owner: string;
  ownerAccountIndex: number;
  code: string;
  commandHash: string;
  price: string;
  status: 'waiting' | 'completed' | 'audit_requested' | 'audit_passed' | 'audit_failed' | 'finalized';
  executor?: string;
  executorAccountIndex?: number;
  auditorAccountIndex?: number;
  result?: string;
  blockNumber: number;
  createdAt: string;
  completedAt?: string;
  finalizedAt?: string;
}

interface ExecutionResult {
  status: number;
  stdout: Buffer;
  stderr: Buffer;
  zip: Buffer;
}

/**
 * Communicates with the executor daemon to run Python code
 */
class DaemonClient {
  private socketPath: string;

  constructor(socketPath: string = SOCKET_PATH) {
    this.socketPath = socketPath;
  }

  /**
   * Send code to the daemon for execution
   * @param formatByte - Format type (1 for Python)
   * @param code - Python code to execute
   * @returns Execution result or null on error
   */
  async sendCode(formatByte: number, code: string): Promise<ExecutionResult | null> {
    return new Promise((resolve) => {
      const sock = net.createConnection(this.socketPath);

      sock.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'ECONNREFUSED') {
          console.error('Error: Cannot connect to daemon. Is it running?');
        } else if (err.code === 'ENOENT') {
          console.error(`Error: Socket not found at ${this.socketPath}`);
        } else {
          console.error(`Error: ${err.message}`);
        }
        resolve(null);
      });

      sock.on('connect', () => {
        try {
          const codeBytes = Buffer.from(code, 'utf-8');
          const payloadSize = codeBytes.length;

          // Pack: 1 byte format + 4 bytes size (big-endian) + code
          const header = Buffer.allocUnsafe(5);
          header.writeUInt8(formatByte, 0);
          header.writeUInt32BE(payloadSize, 1);

          const message = Buffer.concat([header, codeBytes]);
          sock.write(message);
        } catch (err) {
          console.error(`Error sending code: ${err}`);
          sock.destroy();
          resolve(null);
        }
      });

      let receivedData = Buffer.alloc(0);
      let headerReceived = false;
      let expectedSizes: { status: number; stdout: number; stderr: number; zip: number } | null = null;
      let totalExpected = 0;

      sock.on('data', (chunk: Buffer) => {
        receivedData = Buffer.concat([receivedData, chunk]);

        // First, read the 16-byte header
        if (!headerReceived && receivedData.length >= 16) {
          const status = receivedData.readUInt32BE(0);
          const stdoutSize = receivedData.readUInt32BE(4);
          const stderrSize = receivedData.readUInt32BE(8);
          const zipSize = receivedData.readUInt32BE(12);

          expectedSizes = { status, stdout: stdoutSize, stderr: stderrSize, zip: zipSize };
          totalExpected = 16 + stdoutSize + stderrSize + zipSize;
          headerReceived = true;
        }

        // Check if we have received all data
        if (headerReceived && expectedSizes && receivedData.length >= totalExpected) {
          try {
            let offset = 16;

            // Extract stdout
            const stdoutData = receivedData.slice(offset, offset + expectedSizes.stdout);
            offset += expectedSizes.stdout;

            // Extract stderr
            const stderrData = receivedData.slice(offset, offset + expectedSizes.stderr);
            offset += expectedSizes.stderr;

            // Extract zip
            const zipData = receivedData.slice(offset, offset + expectedSizes.zip);

            sock.end();
            resolve({
              status: expectedSizes.status,
              stdout: stdoutData,
              stderr: stderrData,
              zip: zipData
            });
          } catch (err) {
            console.error(`Error parsing response: ${err}`);
            sock.destroy();
            resolve(null);
          }
        }
      });

      sock.on('close', () => {
        if (!headerReceived) {
          resolve(null);
        }
      });
    });
  }

  /**
   * Execute Python code via daemon
   */
  async executePython(code: string): Promise<ExecutionResult | null> {
    return this.sendCode(1, code);
  }
}

/**
 * API client for interacting with the compute market server
 */
class APIClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get all tasks from the API
   */
  async getTasks(): Promise<Task[]> {
    try {
      const response = await fetch(`${this.baseUrl}/tasks`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = (await response.json()) as any;
      return data.tasks || [];
    } catch (error) {
      console.error('Error fetching tasks:', error);
      return [];
    }
  }

  /**
   * Get detailed information about a specific task
   */
  async getTask(taskAddress: string): Promise<Task | null> {
    try {
      const response = await fetch(`${this.baseUrl}/tasks/${taskAddress}`);
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = (await response.json()) as any;
      return data.task || null;
    } catch (error) {
      console.error(`Error fetching task ${taskAddress}:`, error);
      return null;
    }
  }

  /**
   * Get all Hardhat accounts from the API
   */
  async getAccounts(): Promise<Array<{ address: string; balance: string }>> {
    try {
      const response = await fetch(`${this.baseUrl}/accounts`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = (await response.json()) as any;
      return data.accounts || [];
    } catch (error) {
      console.error('Error fetching accounts:', error);
      return [];
    }
  }

  /**
   * Submit task completion result (structured format)
   */
  async completeTask(
    taskAddress: string,
    stdout: string,
    stderr: string,
    exitCode: number,
    zipData: string,
    accountIndex: number
  ): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/tasks/${taskAddress}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ stdout, stderr, exitCode, zipData, accountIndex })
      });

      if (!response.ok) {
        const errorData = (await response.json()) as any;
        console.error(`Error completing task: ${errorData.error || response.statusText}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`Error submitting task completion:`, error);
      return false;
    }
  }

  /**
   * Submit audit result (structured format)
   */
  async submitAuditResult(
    taskAddress: string,
    stdout: string,
    stderr: string,
    exitCode: number,
    zipData: string,
    accountIndex: number
  ): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/tasks/${taskAddress}/submit-audit-result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ stdout, stderr, exitCode, zipData, accountIndex })
      });

      if (!response.ok) {
        const errorData = (await response.json()) as any;
        console.error(`Error submitting audit result: ${errorData.error || response.statusText}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`Error submitting audit result:`, error);
      return false;
    }
  }
}

/**
 * Main executor client that polls for tasks and executes them
 */
class ExecutorClient {
  private executorAddress: string;
  private executorAccountIndex: number | null;
  private apiClient: APIClient;
  private daemonClient: DaemonClient;
  private processedTasks: Set<string>;

  constructor(executorAddress: string) {
    this.executorAddress = executorAddress.toLowerCase();
    this.executorAccountIndex = null;
    this.apiClient = new APIClient(API_BASE_URL);
    this.daemonClient = new DaemonClient();
    this.processedTasks = new Set();
  }

  /**
   * Find the account index for this executor address
   */
  async findAccountIndex(): Promise<number | null> {
    if (this.executorAccountIndex !== null) {
      return this.executorAccountIndex;
    }

    const accounts = await this.apiClient.getAccounts();
    const index = accounts.findIndex(
      account => account.address.toLowerCase() === this.executorAddress
    );

    if (index !== -1) {
      this.executorAccountIndex = index;
      return index;
    }

    return null;
  }

  /**
   * Find tasks assigned to this executor that are waiting to be executed
   */
  async findAssignedTasks(): Promise<Task[]> {
    const allTasks = await this.apiClient.getTasks();

    return allTasks.filter(task =>
      task.executor?.toLowerCase() === this.executorAddress &&
      task.status === 'waiting' &&
      !this.processedTasks.has(task.address)
    );
  }

  /**
   * Find audit tasks assigned to this executor's account index
   */
  async findAuditTasks(): Promise<Task[]> {
    const allTasks = await this.apiClient.getTasks();

    return allTasks.filter(task =>
      task.status === 'audit_requested' &&
      // Just audit all
      //task.auditorAccountIndex === this.executorAccountIndex &&
      !this.processedTasks.has(task.address)
    );
  }

  /**
   * Common method to run code and get execution results
   */
  private async runTask(task: Task, mode: 'execute' | 'audit'): Promise<boolean> {
    const modeLabel = mode === 'execute' ? 'Executing' : 'Auditing';
    const codeLabel = mode === 'execute' ? 'Code to execute' : 'Code to audit';

    console.log(`\n${'='.repeat(60)}`);
    console.log(`${modeLabel} task: ${task.address}`);
    console.log(`Price: ${task.price} ETH`);
    console.log(`${'='.repeat(60)}\n`);

    // Get full task details (including code)
    const fullTask = await this.apiClient.getTask(task.address);
    if (!fullTask || !fullTask.code) {
      console.error(`Cannot get task code for ${task.address}`);
      return false;
    }

    console.log(`${codeLabel}:`);
    console.log('-'.repeat(60));
    console.log(fullTask.code);
    console.log('-'.repeat(60));

    // Execute code via daemon
    console.log('\nExecuting via daemon...');
    const result = await this.daemonClient.executePython(fullTask.code);

    if (!result) {
      console.error('✗ Failed to execute code (daemon error)');
      return false;
    }

    // Display execution output
    if (result.stdout.length > 0) {
      console.log('\nStdout:');
      console.log(result.stdout.toString('utf-8'));
    }

    if (result.stderr.length > 0) {
      console.log('\nStderr:');
      console.log(result.stderr.toString('utf-8'));
    }

    // Prepare structured result data
    const stdout = result.stdout.toString('utf-8');
    const stderr = result.stderr.toString('utf-8');
    const exitCode = result.status;
    const zipData = result.zip.toString('base64');

    // Get account index
    const accountIndex = await this.findAccountIndex();
    if (accountIndex === null) {
      console.error(`✗ Cannot find account index for ${mode === 'execute' ? 'executor' : 'auditor'} address`);
      return false;
    }

    // Submit result to appropriate API endpoint
    console.log(`\nSubmitting ${mode === 'execute' ? 'result' : 'audit result'} to API...`);
    const success = mode === 'execute'
      ? await this.apiClient.completeTask(task.address, stdout, stderr, exitCode, zipData, accountIndex)
      : await this.apiClient.submitAuditResult(task.address, stdout, stderr, exitCode, zipData, accountIndex);

    if (success) {
      console.log(`✓ ${mode === 'execute' ? 'Task completed' : 'Audit completed'} successfully!`);
      this.processedTasks.add(task.address);
      return true;
    } else {
      console.error(`✗ Failed to submit ${mode === 'execute' ? 'task completion' : 'audit result'}`);
      return false;
    }
  }

  /**
   * Execute a task and submit the result
   */
  async executeTask(task: Task): Promise<void> {
    await this.runTask(task, 'execute');
  }

  /**
   * Audit a task and submit the verification result
   */
  async auditTask(task: Task): Promise<void> {
    await this.runTask(task, 'audit');
  }

  /**
   * Main polling loop
   */
  async start(): Promise<void> {
    console.log('Executor Client Started');
    console.log(`Executor Address: ${this.executorAddress}`);
    console.log(`API Server: ${API_BASE_URL}`);
    console.log(`Polling interval: ${POLL_INTERVAL}ms`);

    // Find account index
    const accountIndex = await this.findAccountIndex();
    if (accountIndex !== null) {
      console.log(`Executor Account Index: ${accountIndex}`);
    } else {
      console.warn('Warning: Could not find account index for executor address');
    }

    console.log(`\nWaiting for assigned tasks and audit tasks...\n`);

    while (true) {
      try {
        // Fetch both assigned tasks and audit tasks in parallel
        const [assignedTasks, auditTasks] = await Promise.all([
          this.findAssignedTasks(),
          this.findAuditTasks()
        ]);

        const allTasks = assignedTasks.concat(auditTasks);

        if (allTasks.length > 0) {
          console.log(`Found ${allTasks.length} task(s) (${assignedTasks.length} execution, ${auditTasks.length} audit)`);

          for (const task of allTasks) {
            if (task.status === 'waiting') {
              await this.executeTask(task);
            } else if (task.status === 'audit_requested') {
              await this.auditTask(task);
            }
          }
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
      } catch (error) {
        console.error('Error in polling loop:', error);
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
      }
    }
  }
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Error: Missing executor address argument');
    console.error('Usage: npm start <executor_address>');
    console.error('Example: npm start ');
    process.exit(1);
  }

  const executorAddress = args[0];

  const client = new ExecutorClient(executorAddress);
  await client.start();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\nShutting down gracefully...');
  process.exit(0);
});

// Run the client
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
