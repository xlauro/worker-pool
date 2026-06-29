import { describe, test, expect, afterEach } from 'bun:test';
import { WorkerPool } from '../src/worker-pool';

// Resolution of the test worker path
const workerPath = import.meta.resolve('../src/examples/hash-worker.ts');

describe('WorkerPool Tests', () => {
  let pool: WorkerPool | null = null;

  afterEach(() => {
    if (pool) {
      pool.destroy();
      pool = null;
    }
  });

  test('should execute heavy tasks in parallel successfully', async () => {
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

  test('should queue tasks in the FIFO queue if the pool is full', async () => {
    // Only 1 worker to ensure saturation
    pool = new WorkerPool<{ text: string; iterations: number }, { hash: string }>(
      workerPath,
      { size: 1 }
    );

    expect(pool.getPoolSize()).toBe(1);

    // Submits a heavy task asynchronously
    const p1 = pool.run({ text: 'long_task', iterations: 10 });
    
    // Submits a second task that MUST go to the queue immediately
    const p2 = pool.run({ text: 'queued_task', iterations: 2 });

    // Verifies if the counters match the expected behavior
    expect(pool.getActiveWorkerCount()).toBe(1);
    expect(pool.getQueueLength()).toBe(1);

    const [res1, res2] = await Promise.all([p1, p2]);

    expect(res1.hash).toBeDefined();
    expect(res2.hash).toBeDefined();
    expect(pool.getActiveWorkerCount()).toBe(0);
    expect(pool.getQueueLength()).toBe(0);
  });

  test('should handle worker internal errors without crashing the pool and recover', async () => {
    pool = new WorkerPool<{ text: string; iterations: number }, { hash: string }>(
      workerPath,
      { size: 2 }
    );

    // Dispatches failing task
    const pError = pool.run({ text: 'FORCE_ERROR', iterations: 1 });
    // Dispatches parallel successful task
    const pSuccess = pool.run({ text: 'success_task', iterations: 2 });

    // The error task should fail and the promise be rejected
    expect(pError).rejects.toThrow('Simulated error thrown from inside the worker!');

    // The successful task should finish normally
    const successRes = await pSuccess;
    expect(successRes.hash).toBeDefined();

    // The pool should recover and accept new requests perfectly
    const pNew = await pool.run({ text: 'recovery_task', iterations: 1 });
    expect(pNew.hash).toBeDefined();
  });

  test('should destroy the pool clearing pending and active tasks', async () => {
    pool = new WorkerPool<{ text: string; iterations: number }, { hash: string }>(
      workerPath,
      { size: 2 }
    );

    const p1 = pool.run({ text: 'kill_1', iterations: 10 });
    const p2 = pool.run({ text: 'kill_2', iterations: 10 });
    const p3 = pool.run({ text: 'kill_3', iterations: 10 }); // Stays in the queue

    expect(pool.getActiveWorkerCount()).toBe(2);
    expect(pool.getQueueLength()).toBe(1);

    // Destroys the pool in the middle of execution
    pool.destroy();

    // All running promises should be rejected
    expect(p1).rejects.toThrow('WorkerPool was destroyed');
    expect(p2).rejects.toThrow('WorkerPool was destroyed');
    expect(p3).rejects.toThrow('WorkerPool was destroyed');

    expect(pool.getActiveWorkerCount()).toBe(0);
    expect(pool.getQueueLength()).toBe(0);

    // Attempting to run tasks after destruction should fail immediately
    expect(pool.run({ text: 'late_task', iterations: 1 })).rejects.toThrow(
      'Cannot submit tasks. The WorkerPool has been destroyed.'
    );
  });
});
