import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(new ApiError(404, "ROUTE_NOT_FOUND", `No route for ${req.method} ${req.path}.`));
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    res.status(422).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Some fields need attention.",
        fields: error.flatten().fieldErrors,
        requestId: req.id,
      },
    });
    return;
  }

  if (error instanceof ApiError) {
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        requestId: req.id,
      },
    });
    return;
  }

  console.error(`[${req.id}]`, error);
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "The request could not be completed.",
      requestId: req.id,
    },
  });
}
