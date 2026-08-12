/**
 * Standard API response helpers.
 */
import { Response } from 'express';

export function ok<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({ ok: true, data });
}

export function created<T>(res: Response, data: T): Response {
  return res.status(201).json({ ok: true, data });
}

export function noContent(res: Response): Response {
  return res.status(204).send();
}
