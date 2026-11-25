interface Message {
  id: number;
}

type Progress<Response> = Extract<Response, { progress: unknown }>;
type Result<Response> = Exclude<
  Response,
  { progress: unknown } | { error: unknown }
>;

interface Pending<Response> {
  resolve: (response: Result<Response>) => void;
  reject: (error: Error) => void;
  onProgress?: (response: Progress<Response>) => void;
}

/**
 * Requests to a worker, matched to responses by id. A response with `progress`
 * is interim; one with `error` rejects. If the worker crashes, everything
 * waiting rejects and the next request starts a fresh worker.
 */
export function createWorkerClient<
  Request extends Message,
  Response extends Message,
>(
  /** Written out by each caller, so the bundler finds and builds the worker. */
  create: () => Worker,
  name: string,
  /** Forgets anything the client knew the crashed worker held. */
  onReset?: () => void,
) {
  let worker: Worker | null = null;
  let nextId = 0;
  const pending = new Map<number, Pending<Response>>();

  function failAll(error: Error) {
    for (const request of pending.values()) request.reject(error);
    pending.clear();
    onReset?.();
    worker?.terminate();
    worker = null;
  }

  function getWorker() {
    if (!worker) {
      worker = create();
      worker.onmessage = ({ data }: MessageEvent<Response>) => {
        const request = pending.get(data.id);
        if (!request) return;
        if ("progress" in data) {
          return request.onProgress?.(data as Progress<Response>);
        }
        pending.delete(data.id);
        if ("error" in data) request.reject(new Error(String(data.error)));
        else request.resolve(data as Result<Response>);
      };
      worker.onerror = (event) => {
        event.preventDefault();
        failAll(new Error(event.message || `${name} failed`));
      };
      worker.onmessageerror = () => {
        failAll(new Error(`${name} sent an unreadable message`));
      };
    }
    return worker;
  }

  return {
    nextId: () => nextId++,
    send(
      request: Request,
      options: {
        transfer?: Transferable[];
        onProgress?: (response: Progress<Response>) => void;
      } = {},
    ) {
      return new Promise<Result<Response>>((resolve, reject) => {
        pending.set(request.id, {
          resolve,
          reject,
          onProgress: options.onProgress,
        });
        getWorker().postMessage(request, options.transfer ?? []);
      });
    },
  };
}
