import { describe, test, expect, afterEach } from 'bun:test';
import { WorkerPool } from '../src/worker-pool';

// Resolução do worker de teste
const workerPath = import.meta.resolve('../src/examples/hash-worker.ts');

describe('WorkerPool Tests', () => {
  let pool: WorkerPool | null = null;

  afterEach(() => {
    if (pool) {
      pool.destroy();
      pool = null;
    }
  });

  test('deve executar tarefas pesadas em paralelo com sucesso', async () => {
    pool = new WorkerPool<{ text: string; iterations: number }, { hash: string }>(
      workerPath,
      { size: 2 }
    );

    expect(pool.getPoolSize()).toBe(2);

    const task1 = pool.run({ text: 'antigravity-1', iterations: 2 });
    const task2 = pool.run({ text: 'antigravity-2', iterations: 2 });

    const [res1, res2] = await Promise.all([task1, task2]);

    expect(res1.hash).toBeDefined();
    expect(res1.hash.length).toBeGreaterThan(0);
    expect(res2.hash).toBeDefined();
    expect(res2.hash.length).toBeGreaterThan(0);
  });

  test('deve enfileirar tarefas na fila FIFO se o pool estiver lotado', async () => {
    // Apenas 1 worker para garantir saturação
    pool = new WorkerPool<{ text: string; iterations: number }, { hash: string }>(
      workerPath,
      { size: 1 }
    );

    expect(pool.getPoolSize()).toBe(1);

    // Submete uma tarefa pesada de forma assíncrona
    const p1 = pool.run({ text: 'long_task', iterations: 10 });
    
    // Submete uma segunda tarefa que DEVE ir para a fila imediatamente
    const p2 = pool.run({ text: 'queued_task', iterations: 2 });

    // Verifica se os contadores batem com o comportamento esperado
    expect(pool.getActiveWorkerCount()).toBe(1);
    expect(pool.getQueueLength()).toBe(1);

    const [res1, res2] = await Promise.all([p1, p2]);

    expect(res1.hash).toBeDefined();
    expect(res2.hash).toBeDefined();
    expect(pool.getActiveWorkerCount()).toBe(0);
    expect(pool.getQueueLength()).toBe(0);
  });

  test('deve tratar erros internos do worker sem travar o pool e se recuperar', async () => {
    pool = new WorkerPool<{ text: string; iterations: number }, { hash: string }>(
      workerPath,
      { size: 2 }
    );

    // Dispara tarefa com falha
    const pError = pool.run({ text: 'FORCE_ERROR', iterations: 1 });
    // Dispara tarefa paralela de sucesso
    const pSuccess = pool.run({ text: 'success_task', iterations: 2 });

    // A tarefa de erro deve falhar e a promise ser rejeitada
    expect(pError).rejects.toThrow('Erro simulado disparado de dentro do worker!');

    // A tarefa de sucesso deve terminar normalmente
    const successRes = await pSuccess;
    expect(successRes.hash).toBeDefined();

    // O pool deve se recuperar e aceitar novas requisições perfeitamente
    const pNew = await pool.run({ text: 'recovery_task', iterations: 1 });
    expect(pNew.hash).toBeDefined();
  });

  test('deve encerrar o pool limpando as tarefas pendentes na fila e ativas', async () => {
    pool = new WorkerPool<{ text: string; iterations: number }, { hash: string }>(
      workerPath,
      { size: 2 }
    );

    const p1 = pool.run({ text: 'kill_1', iterations: 10 });
    const p2 = pool.run({ text: 'kill_2', iterations: 10 });
    const p3 = pool.run({ text: 'kill_3', iterations: 10 }); // Fica na fila

    expect(pool.getActiveWorkerCount()).toBe(2);
    expect(pool.getQueueLength()).toBe(1);

    // Destrói o pool no meio da execução
    pool.destroy();

    // Todas as promises em andamento devem ser rejeitadas
    expect(p1).rejects.toThrow('WorkerPool foi destruído');
    expect(p2).rejects.toThrow('WorkerPool foi destruído');
    expect(p3).rejects.toThrow('WorkerPool foi destruído');

    expect(pool.getActiveWorkerCount()).toBe(0);
    expect(pool.getQueueLength()).toBe(0);

    // Tentar executar tarefas após a destruição deve falhar imediatamente
    expect(pool.run({ text: 'late_task', iterations: 1 })).rejects.toThrow(
      'Não é possível submeter tarefas. O WorkerPool foi destruído.'
    );
  });
});
