import type { IncomingMessage, ServerResponse } from "http";

export type VercelApiRequestHandler = (
  req: IncomingMessage,
  res: ServerResponse
) => void;

export declare const vercelApiHandler: VercelApiRequestHandler;
export default vercelApiHandler;
