import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
    if (res.headersSent) {
        return next(err);
    }

    // Handle Zod Validation Errors
    if (err instanceof ZodError) {
        return res.status(400).json({
            error: "Validation error",
            details: err.errors
        });
    }

    // Handle expected application errors by convention (e.g. status code attached to Error object)
    if (err.status) {
        return res.status(err.status).json({ error: err.message });
    }

    // Log unexpected errors
    console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err);

    // Return standard 500 error
    return res.status(500).json({ error: err.message || "Internal Server Error" });
}
