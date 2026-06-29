/**
 * Opções de configuração para inicializar o WorkerPool.
 */
export interface WorkerPoolOptions {
  /**
   * O número de workers a serem instanciados no pool.
   * Se não for fornecido, utiliza `navigator.hardwareConcurrency` por padrão.
   */
  size?: number;
}

/**
 * Representa os detalhes de um erro ocorrido dentro de um worker.
 */
export interface WorkerErrorDetails {
  message: string;
  stack?: string;
}

/**
 * Estrutura da mensagem enviada da thread principal para o Worker.
 */
export interface WorkerRequest<InputData> {
  id: string;
  data: InputData;
}

/**
 * Estrutura da mensagem de resposta enviada do Worker de volta para a thread principal.
 */
export interface WorkerResponse<OutputData> {
  id: string;
  data?: OutputData;
  error?: WorkerErrorDetails;
}

/**
 * Estrutura interna de uma tarefa enfileirada à espera de execução.
 */
export interface QueuedTask<InputData, OutputData> {
  id: string;
  data: InputData;
  resolve: (value: OutputData | PromiseLike<OutputData>) => void;
  reject: (reason?: any) => void;
}

/**
 * Metadados internos que controlam o ciclo de vida e estado de cada thread de Worker.
 */
export interface WorkerInstance {
  worker: Worker;
  status: 'idle' | 'busy';
  activeTaskId: string | null;
}
