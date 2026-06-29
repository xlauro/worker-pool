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

// Escuta as requisições enviadas da thread principal do pool
self.onmessage = async (event: MessageEvent<WorkerRequest<WorkerInput>>) => {
  const { id, data } = event.data;

  try {
    const { text, iterations } = data;

    // Simulação de erro forçado para validação de erros
    if (text === 'FORCE_ERROR') {
      throw new Error('Erro simulado disparado de dentro do worker!');
    }

    let currentHash = text;

    // Simula carga pesada de CPU rodando hashing bcrypt em loop síncrono.
    // Usamos Bun.password.hashSync para forçar o consumo de CPU na thread separada.
    for (let i = 0; i < iterations; i++) {
      currentHash = Bun.password.hashSync(currentHash, {
        algorithm: 'bcrypt',
        cost: 4 // Custo baixo para o exemplo rodar rápido, mas ainda pesado para a CPU
      });
    }

    // Prepara a resposta de sucesso
    const response: WorkerResponse<WorkerOutput> = {
      id,
      data: {
        hash: currentHash,
        iterations
      }
    };

    self.postMessage(response);
  } catch (error: any) {
    // Captura o erro e envia de volta de forma estruturada para rejeitar a Promise principal
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
