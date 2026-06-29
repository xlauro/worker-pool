import { WorkerPool } from '../src/worker-pool';

// Absolute path of the worker resolved at runtime
const workerPath = import.meta.resolve('../src/examples/hash-worker.ts');

const TASKS_COUNT = 50;
const HASH_ITERATIONS = 4; // number of hashes per task (fine-tuned to not take too long)

async function runBenchmark() {
  const cores = navigator.hardwareConcurrency || 4;

  console.log('====================================================');
  console.log('📊 STARTING BENCHMARK: MAIN THREAD VS WORKER POOL');
  console.log(`- CPU Heavy Tasks: ${TASKS_COUNT}`);
  console.log(`- Bcrypt cost (iterations/task): ${HASH_ITERATIONS}`);
  console.log(`- CPU Cores Detected: ${cores}`);
  console.log('====================================================\n');

  // --- PHASE 1: SEQUENTIAL EXECUTION (MAIN THREAD) ---
  console.log('➡️  Phase 1: Processing SEQUENTIALLY on Main Thread...');
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
  console.log(`⏱  Completed in: ${timeSeq.toFixed(2)} ms\n`);

  // --- PHASE 2: PARALLEL EXECUTION (WORKER POOL) ---
  console.log(`➡️  Phase 2: Processing in PARALLEL with WorkerPool (${cores} threads)...`);
  
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

  // Waits for all workers to finish parallel processing
  await Promise.all(promises);
  
  const endPar = performance.now();
  const timePar = endPar - startPar;
  
  // Cleans up the Pool resources
  pool.destroy();
  
  console.log(`⏱  Completed in: ${timePar.toFixed(2)} ms\n`);

  // --- RESULTS COMPARISON ---
  const improvement = ((timeSeq - timePar) / timeSeq) * 100;
  const speedup = timeSeq / timePar;

  console.log('====================== RESULTS ======================');
  console.log(`Sequential Time (Main Thread):  ${timeSeq.toFixed(2)} ms`);
  console.log(`Parallel Time (Worker Pool):    ${timePar.toFixed(2)} ms`);
  console.log(`Speedup Factor:                 ${speedup.toFixed(2)}x`);
  console.log(`Performance Improvement:        ${improvement.toFixed(2)}% faster`);
  console.log('========================================================');
}

runBenchmark().catch(console.error);
