export type Log = {
  address: string;
  topics: string[];
  data: string;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
};

/** Minimal chain access; tests swap in a fake, production uses JSON-RPC over fetch. */
export interface RpcClient {
  blockNumber(): Promise<number>;
  getLogs(f: { address: string; fromBlock: number; toBlock: number; topics: (string | string[] | null)[] }): Promise<Log[]>;
}

export function jsonRpcClient(url: string): RpcClient {
  let id = 0;
  async function call<T>(method: string, params: unknown[]): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`rpc http ${res.status}`);
    const j = (await res.json()) as { result?: T; error?: { message: string } };
    if (j.error) throw new Error(`rpc: ${j.error.message}`);
    return j.result as T;
  }
  const hex = (n: number) => "0x" + n.toString(16);
  return {
    async blockNumber() {
      return parseInt(await call<string>("eth_blockNumber", []), 16);
    },
    async getLogs(f) {
      const raw = await call<{ address: string; topics: string[]; data: string; blockNumber: string; transactionHash: string; logIndex: string }[]>(
        "eth_getLogs", [{ address: f.address, fromBlock: hex(f.fromBlock), toBlock: hex(f.toBlock), topics: f.topics }]);
      return raw.map((l) => ({ ...l, blockNumber: parseInt(l.blockNumber, 16), logIndex: parseInt(l.logIndex, 16) }));
    },
  };
}
