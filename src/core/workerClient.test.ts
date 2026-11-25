import { describe, expect, it, vi } from "vitest";
import { createWorkerClient } from "./workerClient";

type Request = { id: number };
type Response =
  | { id: number; progress: number }
  | { id: number; value: string }
  | { id: number; error: string };

/** Stands in for a Worker; the test plays its side of the conversation. */
class FakeWorker {
  onmessage: ((event: { data: Response }) => void) | null = null;
  onerror:
    | ((event: { message: string; preventDefault(): void }) => void)
    | null = null;
  onmessageerror: (() => void) | null = null;
  posted: Request[] = [];
  terminate = vi.fn();
  postMessage(request: Request) {
    this.posted.push(request);
  }
  reply(data: Response) {
    this.onmessage?.({ data });
  }
}

function setup() {
  const workers: FakeWorker[] = [];
  const onReset = vi.fn();
  const client = createWorkerClient<Request, Response>(
    () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker as unknown as Worker;
    },
    "Test worker",
    onReset,
  );
  return { client, workers, onReset };
}

describe("createWorkerClient", () => {
  it("passes progress along, then resolves with the result", async () => {
    const { client, workers } = setup();
    const onProgress = vi.fn();
    const result = client.send({ id: client.nextId() }, { onProgress });
    workers[0].reply({ id: 0, progress: 0.5 });
    workers[0].reply({ id: 0, value: "done" });
    await expect(result).resolves.toEqual({ id: 0, value: "done" });
    expect(onProgress).toHaveBeenCalledWith({ id: 0, progress: 0.5 });
  });

  it("rejects with the worker's error", async () => {
    const { client, workers } = setup();
    const result = client.send({ id: client.nextId() });
    workers[0].reply({ id: 0, error: "Nope" });
    await expect(result).rejects.toThrow("Nope");
  });

  it("rejects everything waiting when the worker crashes, then starts afresh", async () => {
    const { client, workers, onReset } = setup();
    const first = client.send({ id: client.nextId() });
    const second = client.send({ id: client.nextId() });
    workers[0].onerror?.({ message: "", preventDefault() {} });
    await expect(first).rejects.toThrow("Test worker failed");
    await expect(second).rejects.toThrow("Test worker failed");
    expect(workers[0].terminate).toHaveBeenCalled();
    expect(onReset).toHaveBeenCalled();
    client.send({ id: client.nextId() });
    expect(workers).toHaveLength(2);
  });
});
