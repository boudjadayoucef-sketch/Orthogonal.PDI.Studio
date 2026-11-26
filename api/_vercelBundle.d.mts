import type { IncomingMessage, ServerResponse } from "http";

declare const vercelApiHandler: (
  req: IncomingMessage,
  res: ServerResponse
) => void;

export default vercelApiHandler;
