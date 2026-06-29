# ⚡ @laurohms/fast-worker-pool

A high-performance asynchronous **Worker Pool** specifically designed for the **Bun** runtime. It allows you to manage and delegate CPU-intensive tasks to background threads using Bun's native **Web Workers** API, taking full advantage of executing TypeScript files directly without transpilation steps.

Ideal for cryptography, large-scale data manipulation, compression, and any CPU-intensive processing that might block your application's main Event Loop.

---

## ✨ Features

- 🎯 **Bun Native:** Leverages native TypeScript support in the Bun ecosystem, allowing you to instantiate Workers by pointing directly to `.ts` files.
- 🧬 **Strict TypeScript:** Strongly typed with Generics support for task input and output (`WorkerPool<InputData, OutputData>`).
- 🔄 **FIFO Queue (Producer-Consumer):** When all Workers are busy, new tasks are automatically queued and executed on demand as threads become available.
- 🛡️ **Resilience and Fault Tolerance:** If a thread crashes or throws an unhandled error, the error is isolated and forwarded to the specific task's Promise, the faulty thread is terminated, and a new one is immediately instantiated to keep the Pool healthy.
- 🧹 **Lifecycle Management:** Easy resource clean-up and memory deallocation using the `.destroy()` method.

---

## 📦 Installation

```bash
bun add @laurohms/fast-worker-pool
```

---

## 🚀 Quick Start

To use `fast-worker-pool`, you need two files: the file defining the logic that runs in the **Worker** (background) and the **Main** script (which consumes the Pool).

### 1. Create the Worker File (`src/my-worker.ts`)

The Worker listens for messages containing data and responds back. In Bun, native Web Worker typing uses the global `self` variable.

```typescript
import type { WorkerRequest, WorkerResponse } from '@laurohms/fast-worker-pool/src/types';

declare var self: Worker;

// Define the input and output types
type InputType = { base: number; exponent: number };
type OutputType = { result: number };

self.onmessage = async (event: MessageEvent<WorkerRequest<InputType>>) => {
  const { id, data } = event.data;

  try {
    const { base, exponent } = data;
    
    // CPU-intensive processing (Example: power calculation)
    const power = Math.pow(base, exponent);

    // Send the success response with the corresponding id
    const response: WorkerResponse<OutputType> = {
      id,
      data: { result: power }
    };
    self.postMessage(response);
  } catch (error: any) {
    // Send the error back to the main thread to reject the corresponding Promise
    const response: WorkerResponse<OutputType> = {
      id,
      error: {
        message: error.message || String(error),
        stack: error.stack
      }
    };
    self.postMessage(response);
  }
};
```

### 2. Create the Main Script (`src/index.ts`)

Instantiate the pool pointing to the worker file using `import.meta.resolve` so that Bun dynamically resolves the TypeScript module path.

```typescript
import { WorkerPool } from '@laurohms/fast-worker-pool';

// 1. Instantiate the Pool (specifying input and output types)
const pool = new WorkerPool<{ base: number; exponent: number }, { result: number }>(
  import.meta.resolve('./my-worker.ts'),
  { size: 4 } // Creates 4 parallel instances/threads
);

console.log(`Pool initialized with ${pool.getPoolSize()} Workers.`);

// 2. Submit tasks in parallel
const tasks = [
  { base: 2, exponent: 10 },
  { base: 5, exponent: 3 },
  { base: 10, exponent: 6 },
  { base: 3, exponent: 5 }
];

const promises = tasks.map(async (task, index) => {
  try {
    const res = await pool.run(task);
    console.log(`Task #${index + 1} Resolved: ${task.base}^${task.exponent} = ${res.result}`);
  } catch (err) {
    console.error(`Task #${index + 1} Failed:`, err);
  }
});

// Wait for all executions
await Promise.all(promises);

// 3. Destroy the pool, cleaning up memory and terminating active threads
pool.destroy();
console.log('Pool destroyed successfully!');
```

---

## ⚙️ Configuration Options

When instantiating the `WorkerPool`, you can pass configuration options in the second parameter:

```typescript
const pool = new WorkerPool(workerPath, options);
```

| Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `size` | `number` | `navigator.hardwareConcurrency` | The number of Worker threads to create. If omitted, it will use the total number of CPU cores available on the host machine. |

### Available Methods

- `run(data: InputData): Promise<OutputData>`: Dispatches task data to the pool, returning a Promise with the result.
- `getActiveWorkerCount(): number`: Returns the number of Workers currently executing tasks.
- `getQueueLength(): number`: Returns the number of tasks waiting in the FIFO queue.
- `getPoolSize(): number`: Returns the total number of Workers instantiated in the Pool.
- `destroy(): void`: Gracefully terminates all active Workers, clears the queue, and rejects any pending Promises.

---

## 🧪 Development: Tests & Benchmarks

The repository is pre-configured with tests and an automated benchmark script.

### Run Unit Tests

Runs the Bun test suite, validating parallel concurrency, behavior under FIFO queue overload, worker error handling/isolation, and resource destruction.

```bash
bun test
```

### Run Performance Benchmark

The benchmark compares processing **50 CPU-intensive** bcrypt tasks on the Main Thread (blocking) versus the `WorkerPool` using the CPU's maximum core capacity in parallel.

```bash
bun run benchmark
```

_Example benchmark output:_
```text
====================================================
📊 STARTING BENCHMARK: MAIN THREAD VS WORKER POOL
- CPU Heavy Tasks: 50
- Bcrypt cost (iterations/task): 4
- CPU Cores Detected: 8
====================================================

➡️  Phase 1: Processing SEQUENTIALLY on Main Thread...
⏱  Completed in: 382.10 ms

➡️  Phase 2: Processing in PARALLEL with WorkerPool (8 threads)...
⏱  Completed in: 76.50 ms

====================== RESULTS ======================
Sequential Time (Main Thread):  382.10 ms
Parallel Time (Worker Pool):    76.50 ms
Speedup Factor:                 4.99x
Performance Improvement:        80.00% faster
========================================================
```

---

## 📄 License

This project is licensed under the [MIT](LICENSE) license.
