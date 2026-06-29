/**
 * Configuration options for initializing the WorkerPool.
 */
export interface WorkerPoolOptions {
  /**
   * The number of workers to instantiate in the pool.
   * If not provided, defaults to `navigator.hardwareConcurrency`.
   */
  size?: number;
}

/**
 * Represents the details of an error that occurred inside a worker.
 */
export interface WorkerErrorDetails {
  message: string;
  stack?: string;
}

/**
 * Structure of the message sent from the main thread to the Worker.
 */
export interface WorkerRequest<InputData> {
  id: string;
  data: InputData;
}

/**
 * Structure of the response message sent from the Worker back to the main thread.
 */
export interface WorkerResponse<OutputData> {
  id: string;
  data?: OutputData;
  error?: WorkerErrorDetails;
}

/**
 * Internal structure of a queued task waiting for execution.
 */
export interface QueuedTask<InputData, OutputData> {
  id: string;
  data: InputData;
  resolve: (value: OutputData | PromiseLike<OutputData>) => void;
  reject: (reason?: any) => void;
}

/**
 * Internal metadata controlling the lifecycle and state of each Worker thread.
 */
export interface WorkerInstance {
  worker: Worker;
  status: 'idle' | 'busy';
  activeTaskId: string | null;
}
