# ⚡ @laurohms/fast-worker-pool

Um **Worker Pool** assíncrono de altíssima performance projetado especificamente para o runtime **Bun**. Permite gerenciar e delegar tarefas intensivas de CPU para threads em segundo plano utilizando a API nativa de **Web Workers** do Bun, aproveitando ao máximo a execução de arquivos TypeScript sem etapas de transpilação.

Ideal para criptografia, manipulação de dados em larga escala, compressão e qualquer processamento intensivo de CPU que possa bloquear a Event Loop principal da sua aplicação.

---

## ✨ Características

- 🎯 **Bun Native:** Aproveita o suporte nativo a TypeScript no ecossistema Bun, permitindo instanciar Workers apontando diretamente para arquivos `.ts`.
- 🧬 **TypeScript Estrito:** Fortemente tipado com suporte a Generics para entrada e saída das tarefas (`WorkerPool<InputData, OutputData>`).
- 🔄 **Fila de Espera FIFO (Producer-Consumer):** Quando todos os Workers estiverem ocupados, as novas tarefas são enfileiradas automaticamente e executadas sob demanda conforme as threads forem liberadas.
- 🛡️ **Resiliência e Recuperação a Falhas:** Se uma thread travar ou disparar um erro não tratado, o erro é isolado e repassado para a Promise da tarefa específica, a thread com defeito é eliminada e uma nova é instanciada no lugar imediatamente para manter o Pool saudável.
- 🧹 **Gerenciamento de Ciclo de Vida:** Controle fácil de desalocação e limpeza de memória usando o método `.destroy()`.

---

## 📦 Instalação

```bash
bun add @laurohms/fast-worker-pool
```

---

## 🚀 Guia Rápido (Quick Start)

Para utilizar o `fast-worker-pool`, você precisa de dois arquivos: o arquivo que define a lógica que rodará no **Worker** (segundo plano) e o script **Principal** (que consome o Pool).

### 1. Crie o arquivo do Worker (`src/my-worker.ts`)

O Worker escuta mensagens contendo dados e responde de volta. No Bun, a tipagem nativa de Web Worker usa a variável global `self`.

```typescript
import type { WorkerRequest, WorkerResponse } from '@laurohms/fast-worker-pool/src/types';

declare var self: Worker;

// Definindo o tipo de entrada (Input) e de saída (Output)
type InputType = { base: number; exponent: number };
type OutputType = { result: number };

self.onmessage = async (event: MessageEvent<WorkerRequest<InputType>>) => {
  const { id, data } = event.data;

  try {
    const { base, exponent } = data;
    
    // Processamento pesado (Exemplo: cálculo de potência)
    const power = Math.pow(base, exponent);

    // Envia a resposta de sucesso com o id correspondente
    const response: WorkerResponse<OutputType> = {
      id,
      data: { result: power }
    };
    self.postMessage(response);
  } catch (error: any) {
    // Envia o erro de volta para a thread principal rejeitar a Promise correspondente
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

### 2. Crie o Script Principal (`src/index.ts`)

Instancie o pool apontando para o arquivo do worker usando `import.meta.resolve` para que o Bun localize o caminho do módulo TypeScript de forma dinâmica.

```typescript
import { WorkerPool } from '@laurohms/fast-worker-pool';

// 1. Instancia o Pool (especificando os tipos de entrada e saída)
const pool = new WorkerPool<{ base: number; exponent: number }, { result: number }>(
  import.meta.resolve('./my-worker.ts'),
  { size: 4 } // Cria 4 instâncias/threads em paralelo
);

console.log(`Pool inicializado com ${pool.getPoolSize()} Workers.`);

// 2. Submete tarefas em paralelo
const tasks = [
  { base: 2, exponent: 10 },
  { base: 5, exponent: 3 },
  { base: 10, exponent: 6 },
  { base: 3, exponent: 5 }
];

const promises = tasks.map(async (task, index) => {
  try {
    const res = await pool.run(task);
    console.log(`Tarefa #${index + 1} Resolvida: ${task.base}^${task.exponent} = ${res.result}`);
  } catch (err) {
    console.error(`Tarefa #${index + 1} Falhou:`, err);
  }
});

// Aguarda todas as execuções
await Promise.all(promises);

// 3. Destrói o pool limpando a memória e encerrando as threads ativas
pool.destroy();
console.log('Pool destruído com sucesso!');
```

---

## ⚙️ Opções de Configuração

Ao instanciar o `WorkerPool`, você pode passar configurações no segundo parâmetro:

```typescript
const pool = new WorkerPool(workerPath, options);
```

| Propriedade | Tipo | Padrão | Descrição |
| :--- | :--- | :--- | :--- |
| `size` | `number` | `navigator.hardwareConcurrency` | O número de threads de Worker a serem criadas. Se omitido, usará o número total de núcleos de CPU disponíveis no computador host. |

### Métodos Disponíveis na Classe

- `run(data: InputData): Promise<OutputData>`: Envia dados de tarefa para o pool, retornando uma Promise com o resultado.
- `getActiveWorkerCount(): number`: Retorna o número de Workers atualmente executando processamentos.
- `getQueueLength(): number`: Retorna o número de tarefas que estão aguardando na fila FIFO.
- `getPoolSize(): number`: Retorna o total de Workers instanciados no Pool.
- `destroy(): void`: Encerra fisicamente todos os Workers ativos, limpa a fila e rejeita as Promises em andamento.

---

## 🧪 Desenvolvimento: Testes & Benchmarks

O repositório já vem preparado com testes e um script de benchmark automatizado.

### Executar Testes Unitários

Executa a suite de testes no Bun que valida concorrência paralela, comportamento sob sobrecarga de fila FIFO, manipulação/isolamento de erros do worker e destruição de recursos.

```bash
bun test
```

### Executar Benchmark de Performance

O benchmark compara o processamento de **50 tarefas intensivas** de criptografia bcrypt na Thread Principal (bloqueante) contra o `WorkerPool` utilizando a capacidade máxima de cores da sua CPU de forma paralela.

```bash
bun run benchmark
```

_Exemplo de saída do benchmark:_
```text
====================================================
📊 INICIANDO BENCHMARK: THREAD PRINCIPAL VS WORKER POOL
- Tarefas Pesadas de CPU: 50
- Custo do bcrypt (iterações/tarefa): 4
- Cores de CPU Detectados: 8
====================================================

➡️  Fase 1: Processando de forma SEQUENCIAL na Thread Principal...
⏱  Concluído em: 382.10 ms

➡️  Fase 2: Processando em PARALELO com WorkerPool (8 threads)...
⏱  Concluído em: 76.50 ms

====================== RESULTADOS ======================
Tempo Sequencial (Thread Principal):  382.10 ms
Tempo Paralelo (Worker Pool):        76.50 ms
Fator de Aceleração (Speedup):       4.99x
Melhoria de Performance:            80.00% mais rápido
========================================================
```

---

## 📄 Licença

Este projeto está licenciado sob a licença [MIT](LICENSE).
