import { WorkerPool } from '../src/worker-pool';

// Caminho absoluto do worker resolvido em tempo de execução
const workerPath = import.meta.resolve('../src/examples/hash-worker.ts');

const TASKS_COUNT = 50;
const HASH_ITERATIONS = 4; // quantidade de hashes por tarefa (ajuste fino para não demorar demais)

async function runBenchmark() {
  const cores = navigator.hardwareConcurrency || 4;

  console.log('====================================================');
  console.log('📊 INICIANDO BENCHMARK: THREAD PRINCIPAL VS WORKER POOL');
  console.log(`- Tarefas Pesadas de CPU: ${TASKS_COUNT}`);
  console.log(`- Custo do bcrypt (iterações/tarefa): ${HASH_ITERATIONS}`);
  console.log(`- Cores de CPU Detectados: ${cores}`);
  console.log('====================================================\n');

  // --- FASE 1: EXECUÇÃO SEQUENCIAL (THREAD PRINCIPAL) ---
  console.log('➡️  Fase 1: Processando de forma SEQUENCIAL na Thread Principal...');
  const startSeq = performance.now();
  
  for (let i = 0; i < TASKS_COUNT; i++) {
    let currentHash = `benchmark-input-${i}`;
    for (let j = 0; j < HASH_ITERATIONS; j++) {
      currentHash = Bun.password.hashSync(currentHash, {
        algorithm: 'bcrypt',
        cost: 4
      });
    }
  }
  const endSeq = performance.now();
  const timeSeq = endSeq - startSeq;
  console.log(`⏱  Concluído em: ${timeSeq.toFixed(2)} ms\n`);

  // --- FASE 2: EXECUÇÃO PARALELA (WORKER POOL) ---
  console.log(`➡️  Fase 2: Processando em PARALELO com WorkerPool (${cores} threads)...`);
  
  const pool = new WorkerPool<{ text: string; iterations: number }, { hash: string; iterations: number }>(
    workerPath,
    { size: cores }
  );

  const startPar = performance.now();
  const promises: Promise<any>[] = [];

  for (let i = 0; i < TASKS_COUNT; i++) {
    promises.push(
      pool.run({
        text: `benchmark-input-${i}`,
        iterations: HASH_ITERATIONS
      })
    );
  }

  // Aguarda todos os workers terminarem o processamento paralelo
  await Promise.all(promises);
  
  const endPar = performance.now();
  const timePar = endPar - startPar;
  
  // Limpa os recursos do Pool
  pool.destroy();
  
  console.log(`⏱  Concluído em: ${timePar.toFixed(2)} ms\n`);

  // --- COMPARAÇÃO DOS RESULTADOS ---
  const improvement = ((timeSeq - timePar) / timeSeq) * 100;
  const speedup = timeSeq / timePar;

  console.log('====================== RESULTADOS ======================');
  console.log(`Tempo Sequencial (Thread Principal):  ${timeSeq.toFixed(2)} ms`);
  console.log(`Tempo Paralelo (Worker Pool):        ${timePar.toFixed(2)} ms`);
  console.log(`Fator de Aceleração (Speedup):       ${speedup.toFixed(2)}x`);
  console.log(`Melhoria de Performance:            ${improvement.toFixed(2)}% mais rápido`);
  console.log('========================================================');
}

runBenchmark().catch(console.error);
