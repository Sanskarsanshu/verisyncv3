import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';

function handleError(res: Response, err: unknown, next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }
  next(err as Error);
}

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      handleError(res, err, next);
    }
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as unknown as Request['query'];
      next();
    } catch (err) {
      handleError(res, err, next);
    }
  };
}
