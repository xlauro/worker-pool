import type {
  WorkerPoolOptions,
  QueuedTask,
  WorkerInstance,
  WorkerRequest,
  WorkerResponse
} from './types';

/**
 * Classe principal que gerencia o Pool de Workers.
 * Implementa o padrão de projeto Producer-Consumer para gerenciar uma fila FIFO
 * de tarefas assíncronas concorrentes rodando em threads nativas do Bun.
 */
export class WorkerPool<InputData = any, OutputData = any> {
  private readonly workerPath: string | URL;
  private readonly size: number;
  private readonly workers: WorkerInstance[] = [];
  private readonly queue: QueuedTask<InputData, OutputData>[] = [];
  private readonly pendingTasks = new Map<
    string,
    {
      resolve: (value: OutputData | PromiseLike<OutputData>) => void;
      reject: (reason?: any) => void;
    }
  >();
  private isDestroyed = false;
  private taskCounter = 0;

  /**
   * Inicializa o Worker Pool.
   * 
   * @param workerPath Caminho absoluto ou URL do script do Worker (ex: resolvido via `import.meta.resolve("./worker.ts")`).
   * @param options Configurações adicionais para o Pool, como o número de threads.
   */
  constructor(workerPath: string | URL, options?: WorkerPoolOptions) {
    this.workerPath = workerPath;
    
    // Determina o tamanho do pool com base no hardware do host se não fornecido
    const concurrency = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 4;
    this.size = options?.size ?? concurrency ?? 4;

    if (this.size <= 0) {
      throw new Error('O tamanho do pool de workers deve ser um número inteiro positivo.');
    }

    this.initializeWorkers();
  }

  /**
   * Cria e pré-aloca a quantidade de Workers configurada no pool.
   */
  private initializeWorkers(): void {
    for (let i = 0; i < this.size; i++) {
      this.workers.push(this.createWorkerInstance(i));
    }
  }

  /**
   * Instancia um Worker individual e define seus manipuladores de eventos e erros.
   */
  private createWorkerInstance(index: number): WorkerInstance {
    const worker = new Worker(this.workerPath);
    
    const instance: WorkerInstance = {
      worker,
      status: 'idle',
      activeTaskId: null,
    };

    // Escuta retornos normais de processamento do Worker
    worker.onmessage = (event: MessageEvent<WorkerResponse<OutputData>>) => {
      if (this.isDestroyed) return;

      const { id, data, error } = event.data;
      const pending = this.pendingTasks.get(id);

      // Marca o worker como ocioso assim que o processamento termina
      if (instance.activeTaskId === id) {
        instance.status = 'idle';
        instance.activeTaskId = null;
      }

      if (pending) {
        this.pendingTasks.delete(id);
        if (error) {
          pending.reject(new Error(error.message));
        } else if (data !== undefined) {
          pending.resolve(data);
        } else {
          pending.reject(new Error('O Worker retornou sucesso sem dados.'));
        }
      }

      // Processa a próxima tarefa enfileirada, se houver
      this.processQueue();
    };

    // Escuta erros inesperados disparados internamente na thread do Worker
    worker.onerror = (errorEvent: ErrorEvent) => {
      if (this.isDestroyed) return;

      // Rejeita a tarefa ativa rodando nesse worker, caso exista
      if (instance.activeTaskId) {
        const pending = this.pendingTasks.get(instance.activeTaskId);
        if (pending) {
          this.pendingTasks.delete(instance.activeTaskId);
          pending.reject(
            new Error(
              errorEvent.message || 'Worker falhou inesperadamente com um erro interno.'
            )
          );
        }
      }

      // Termina a instância antiga problemática por segurança e limpa memória
      worker.terminate();

      // Regenera o Worker no mesmo slot para restaurar a capacidade do pool
      this.workers[index] = this.createWorkerInstance(index);

      // Tenta processar o fluxo da fila no novo Worker
      this.processQueue();
    };

    return instance;
  }

  /**
   * Envia uma tarefa para processamento no pool.
   * Se houver um Worker livre, a tarefa é iniciada imediatamente. Caso contrário,
   * ela entra na fila FIFO de forma transparente e aguarda liberação de recursos.
   * 
   * @param data Dados de entrada da tarefa a serem passados para o Worker.
   * @returns Uma Promise que resolve com o resultado gerado pelo Worker ou rejeita em caso de erro.
   */
  public run(data: InputData): Promise<OutputData> {
    if (this.isDestroyed) {
      return Promise.reject(
        new Error('Não é possível submeter tarefas. O WorkerPool foi destruído.')
      );
    }

    // Cria um identificador único seguro para esta execução de tarefa
    const id = `task-${++this.taskCounter}-${Math.random().toString(36).substring(2, 9)}`;

    return new Promise<OutputData>((resolve, reject) => {
      // Procura por um Worker ocioso
      const idleWorker = this.workers.find((w) => w.status === 'idle');

      if (idleWorker) {
        // Vincula a promise ativa e inicia o processamento no Worker
        this.pendingTasks.set(id, { resolve, reject });
        this.dispatchTask(idleWorker, id, data);
      } else {
        // Enfileira a tarefa (padrão Producer-Consumer)
        this.queue.push({ id, data, resolve, reject });
      }
    });
  }

  /**
   * Envia a mensagem com os dados de tarefa para o Worker específico.
   */
  private dispatchTask(instance: WorkerInstance, id: string, data: InputData): void {
    instance.status = 'busy';
    instance.activeTaskId = id;

    const request: WorkerRequest<InputData> = { id, data };
    instance.worker.postMessage(request);
  }

  /**
   * Consome itens da fila FIFO e envia para os Workers conforme fiquem disponíveis.
   */
  private processQueue(): void {
    if (this.isDestroyed || this.queue.length === 0) return;

    const idleWorker = this.workers.find((w) => w.status === 'idle');
    if (!idleWorker) return;

    // Extrai o primeiro item da fila FIFO
    const nextTask = this.queue.shift();
    if (nextTask) {
      const { id, data, resolve, reject } = nextTask;
      this.pendingTasks.set(id, { resolve, reject });
      this.dispatchTask(idleWorker, id, data);
    }
  }

  /**
   * Obtém a quantidade atual de workers em processamento ativo.
   */
  public getActiveWorkerCount(): number {
    return this.workers.filter((w) => w.status === 'busy').length;
  }

  /**
   * Obtém a quantidade de tarefas paradas na fila de espera FIFO.
   */
  public getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Obtém o número total de Workers alocados no Pool.
   */
  public getPoolSize(): number {
    return this.workers.length;
  }

  /**
   * Encerra todos os Workers ativos e limpa a fila de tarefas remanescentes.
   * Cancela todas as Promises em andamento rejeitando-as.
   */
  public destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    // Cancela todas as tarefas que estavam na fila sem rodar
    for (const task of this.queue) {
      task.reject(
        new Error('WorkerPool foi destruído antes que esta tarefa pudesse ser executada.')
      );
    }
    this.queue.length = 0;

    // Rejeita todas as tarefas que estavam ativas rodando nas threads
    for (const [id, pending] of this.pendingTasks.entries()) {
      pending.reject(
        new Error('WorkerPool foi destruído durante o processamento desta tarefa.')
      );
    }
    this.pendingTasks.clear();

    // Termina todos os workers fisicamente
    for (const instance of this.workers) {
      instance.worker.terminate();
    }
    this.workers.length = 0;
  }
}
