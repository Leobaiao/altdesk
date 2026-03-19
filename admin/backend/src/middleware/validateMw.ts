import { Request, Response, NextFunction } from "express";
import { AnyZodObject, ZodError } from "zod";

/**
 * Validates req.body, req.query, or req.params against a Zod schema.
 * Will pass the error to NextFunction for the global ErrorHandler if it fails.
 */
export const validateBody = (schema: AnyZodObject) =>
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            req.body = await schema.parseAsync(req.body);
            return next();
        } catch (error) {
            if (error instanceof ZodError) {
                next(error);
            } else {
                next(new Error("Unknown validation error"));
            }
        }
    };

export const validateQuery = (schema: AnyZodObject) =>
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            req.query = await schema.parseAsync(req.query);
            return next();
        } catch (error) {
            next(error);
        }
    };
