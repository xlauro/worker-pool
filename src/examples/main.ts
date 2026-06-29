import { WorkerPool } from '../worker-pool';

// Securely resolve the worker path using import.meta.resolve
const workerPath = import.meta.resolve('./hash-worker.ts');

async function main() {
  console.log('====================================================');
  console.log('🚀 Starting Fast Worker Pool Demonstration');
  console.log('====================================================');

  // Initialize the pool with a fixed size of 3 workers
  const poolSize = 3;
  const pool = new WorkerPool<{ text: string; iterations: number }, { hash: string; iterations: number }>(
    workerPath,
    { size: poolSize }
  );

  console.log(`✔ WorkerPool created with ${pool.getPoolSize()} active workers.`);
  console.log(`✔ Maximum parallel capacity: ${poolSize} threads.`);
  console.log('----------------------------------------------------');

  // List of tasks containing normal texts and one task with FORCE_ERROR to simulate failure
  const tasks = [
    { text: 'antigravity_master_1', iterations: 10 },
    { text: 'antigravity_master_2', iterations: 10 },
    { text: 'FORCE_ERROR', iterations: 1 }, // This task will fail in the worker
    { text: 'antigravity_master_4', iterations: 10 },
    { text: 'antigravity_master_5', iterations: 10 },
    { text: 'antigravity_master_6', iterations: 10 },
  ];

  console.log(`Dispatching ${tasks.length} concurrent tasks...`);

  // Periodic interval to display pool metrics during execution
  const monitor = setInterval(() => {
    console.log(
      `[Monitor] Active Workers: ${pool.getActiveWorkerCount()} | FIFO Queue Length: ${pool.getQueueLength()}`
    );
  }, 150);

  // Execute all in parallel using Promise.all
  const promises = tasks.map(async (task, index) => {
    try {
      console.log(`[Task ${index + 1}] Submitting to Pool (text: "${task.text}")`);
      const start = performance.now();
      const result = await pool.run(task);
      const elapsed = (performance.now() - start).toFixed(1);
      
      console.log(
        `[Task ${index + 1}] ✅ Resolved in ${elapsed}ms -> Hash: ${result.hash.slice(0, 30)}...`
      );
      return result;
    } catch (error: any) {
      console.log(`[Task ${index + 1}] ❌ Rejected with Error -> "${error.message}"`);
      return null;
    }
  });

  await Promise.all(promises);

  clearInterval(monitor);
  console.log('----------------------------------------------------');
  console.log('All concurrent jobs have finished.');
  
  // Clean up the pool by releasing resources
  pool.destroy();
  console.log('🧹 WorkerPool destroyed and instances cleaned.');
  console.log('====================================================');
}

main().catch(console.error);
