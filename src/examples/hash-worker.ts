import type { WorkerRequest, WorkerResponse } from '../types';

declare var self: Worker;

interface WorkerInput {
  text: string;
  iterations: number;
}

interface WorkerOutput {
  hash: string;
  iterations: number;
}

// Listens to requests sent from the main pool thread
self.onmessage = async (event: MessageEvent<WorkerRequest<WorkerInput>>) => {
  const { id, data } = event.data;

  try {
    const { text, iterations } = data;

    // Simulated forced error for error handling validation
    if (text === 'FORCE_ERROR') {
      throw new Error('Simulated error thrown from inside the worker!');
    }

    let currentHash = text;

    // Simulates heavy CPU load by running bcrypt hashing in a synchronous loop.
    // We use Bun.password.hashSync to force CPU consumption on the separate thread.
    for (let i = 0; i < iterations; i++) {
      currentHash = Bun.password.hashSync(currentHash, {
        algorithm: 'bcrypt',
        cost: 4 // Low cost to run quickly in the example, but still CPU intensive
      });
    }

    // Prepares the success response
    const response: WorkerResponse<WorkerOutput> = {
      id,
      data: {
        hash: currentHash,
        iterations
      }
    };

    self.postMessage(response);
  } catch (error: any) {
    // Captures the error and sends it back in a structured format to reject the main Promise
    const response: WorkerResponse<WorkerOutput> = {
      id,
      error: {
        message: error.message || String(error),
        stack: error.stack
      }
    };

    self.postMessage(response);
  }
};
