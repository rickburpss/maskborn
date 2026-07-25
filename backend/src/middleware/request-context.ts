import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export function requestContext(req: Request, res: Response, next: NextFunction) {
  req.id = req.header("x-request-id")?.slice(0, 80) || randomUUID();
  res.setHeader("x-request-id", req.id);
  next();
}
