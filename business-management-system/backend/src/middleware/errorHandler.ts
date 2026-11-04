import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  errors?: Array<{ field: string; message: string }>;
  code?: string;
}

export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Handle Prisma unique constraint error
  if (err.code === 'P2002') {
    statusCode = 409;
    message = 'A record with this unique identifier or code already exists.';
  }

  // Handle Prisma foreign key constraint error
  if (err.code === 'P2003') {
    statusCode = 400;
    message = 'Referential integrity violation: invalid or restricted foreign relation.';
  }

  // Handle PostgreSQL custom trigger exception
  if (err.code === 'P0001' || (err.message && err.message.includes('overlaps with an existing financial year'))) {
    statusCode = 409;
    message = 'Financial year date range overlaps with an existing financial year for this company.';
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(err.errors && { errors: err.errors }),
    },
  });
};
