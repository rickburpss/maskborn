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
    const first = error.issues[0];
    const field = first?.path.length ? first.path.join(".") : "request";
    res.status(422).json({
      error: {
        code: "VALIDATION_ERROR",
        message: first ? `${field}: ${first.message}` : "The request data is invalid.",
        fields: error.flatten().fieldErrors,
        issues: error.issues,
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

  const prismaError = error as {
    code?: unknown;
    meta?: { target?: unknown; constraint?: unknown };
  };
  if (typeof prismaError?.code === "string") {
    const target = JSON.stringify(prismaError.meta?.target ?? prismaError.meta?.constraint ?? "");
    if (prismaError.code === "P2002") {
      const accessoryName = target.includes("normalizedName");
      const xUsername = target.includes("claimKey");
      res.status(409).json({
        error: {
          code: accessoryName ? "ACCESSORY_NAME_TAKEN" : xUsername ? "X_USERNAME_TAKEN" : "DUPLICATE_RESOURCE",
          message: accessoryName
            ? "That accessory name was just taken. Choose another name and publish again."
            : xUsername
              ? "That X username is already linked to a Mask Born account."
            : "An identical record already exists.",
          details: { target: prismaError.meta?.target },
          requestId: req.id,
        },
      });
      return;
    }
    if (prismaError.code === "P2003") {
      res.status(409).json({
        error: {
          code: "RELATED_RECORD_MISSING",
          message: "A related record changed before this action completed. Reload and try again.",
          details: { constraint: prismaError.meta?.constraint },
          requestId: req.id,
        },
      });
      return;
    }
    if (prismaError.code === "P2034") {
      res.status(409).json({
        error: {
          code: "WRITE_CONFLICT",
          message: "Another update happened at the same time. Please try this action again.",
          requestId: req.id,
        },
      });
      return;
    }
    if (prismaError.code === "P2025") {
      res.status(404).json({
        error: {
          code: "RECORD_NOT_FOUND",
          message: "The record for this action no longer exists.",
          requestId: req.id,
        },
      });
      return;
    }
    if (prismaError.code === "P2021") {
      res.status(503).json({
        error: {
          code: "DATABASE_SCHEMA_OUTDATED",
          message: "The database schema is not ready for this feature. Apply the latest Prisma schema and retry.",
          requestId: req.id,
        },
      });
      return;
    }
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
