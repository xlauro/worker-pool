import { WorkerPool } from '../worker-pool';

// Resolve o caminho do worker de forma segura usando import.meta.resolve
const workerPath = import.meta.resolve('./hash-worker.ts');

async function main() {
  console.log('====================================================');
  console.log('🚀 Iniciando Demonstração do Fast Worker Pool');
  console.log('====================================================');

  // Inicializa o pool com tamanho fixo de 3 workers
  const poolSize = 3;
  const pool = new WorkerPool<{ text: string; iterations: number }, { hash: string; iterations: number }>(
    workerPath,
    { size: poolSize }
  );

  console.log(`✔ WorkerPool criado com ${pool.getPoolSize()} workers ativos.`);
  console.log(`✔ Capacidade máxima paralela: ${poolSize} threads.`);
  console.log('----------------------------------------------------');

  // Lista de tarefas contendo textos normais e uma tarefa com FORCE_ERROR para simular erro
  const tasks = [
    { text: 'antigravity_master_1', iterations: 10 },
    { text: 'antigravity_master_2', iterations: 10 },
    { text: 'FORCE_ERROR', iterations: 1 }, // Esta tarefa irá falhar no worker
    { text: 'antigravity_master_4', iterations: 10 },
    { text: 'antigravity_master_5', iterations: 10 },
    { text: 'antigravity_master_6', iterations: 10 },
  ];

  console.log(`Disparando ${tasks.length} tarefas concorrentes...`);

  // Intervalo periódico para exibir o monitoramento do pool durante a execução
  const monitor = setInterval(() => {
    console.log(
      `[Monitor] Workers Ativos: ${pool.getActiveWorkerCount()} | Fila de Espera FIFO: ${pool.getQueueLength()}`
    );
  }, 150);

  // Executa todas em paralelo usando Promise.all
  const promises = tasks.map(async (task, index) => {
    try {
      console.log(`[Task ${index + 1}] Submetendo para o Pool (text: "${task.text}")`);
      const start = performance.now();
      const result = await pool.run(task);
      const elapsed = (performance.now() - start).toFixed(1);
      
      console.log(
        `[Task ${index + 1}] ✅ Resolvida em ${elapsed}ms -> Hash: ${result.hash.slice(0, 30)}...`
      );
      return result;
    } catch (error: any) {
      console.log(`[Task ${index + 1}] ❌ Rejeitada com Erro -> "${error.message}"`);
      return null;
    }
  });

  await Promise.all(promises);

  clearInterval(monitor);
  console.log('----------------------------------------------------');
  console.log('Todos os jobs concorrentes foram finalizados.');
  
  // Limpa o pool liberando os recursos
  pool.destroy();
  console.log('🧹 WorkerPool destruído e instâncias limpas.');
  console.log('====================================================');
}

main().catch(console.error);
