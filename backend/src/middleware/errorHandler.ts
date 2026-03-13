import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../lib/logger.js";

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
    if (res.headersSent) {
        return next(err);
    }

    // Handle Zod Validation Errors
    if (err instanceof ZodError) {
        logger.warn({
            requestId: (req as any).requestId,
            url: req.originalUrl,
            method: req.method,
            issues: err.errors
        }, "Validation error");

        return res.status(400).json({
            error: "Validation error",
            details: err.errors
        });
    }

    // Handle expected application errors (status code attached to Error object)
    if (err.status) {
        logger.warn({
            requestId: (req as any).requestId,
            url: req.originalUrl,
            method: req.method,
            status: err.status,
            message: err.message
        }, "Application error");

        return res.status(err.status).json({ error: err.message });
    }

    // Log unexpected errors (500)
    logger.error({
        requestId: (req as any).requestId,
        url: req.originalUrl,
        method: req.method,
        userId: (req as any).user?.userId,
        tenantId: (req as any).user?.tenantId,
        error: err.message,
        stack: err.stack,
        code: err.code // SQL error codes etc.
    }, `Unhandled error: ${err.message}`);

    const isDev = process.env.NODE_ENV !== "production";
    return res.status(500).json({
        error: isDev ? (err.message || "Internal Server Error") : "Internal Server Error",
        ...(isDev && { requestId: (req as any).requestId })
    });
}
