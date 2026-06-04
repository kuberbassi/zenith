import { Request, Response, NextFunction } from 'express';

function sanitizeValue(val: any): any {
  if (typeof val === 'string') {
    // Strip HTML tags (<...>) and common script tags/handlers
    return val.replace(/<[^>]*>/g, '');
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeValue);
  }
  if (val && typeof val === 'object') {
    const res: Record<string, any> = {};
    for (const key of Object.keys(val)) {
      res[key] = sanitizeValue(val[key]);
    }
    return res;
  }
  return val;
}

export function xssSanitize(req: Request, _res: Response, next: NextFunction): void {
  if (req.body) {
    req.body = sanitizeValue(req.body);
  }
  if (req.query) {
    req.query = sanitizeValue(req.query);
  }
  if (req.params) {
    req.params = sanitizeValue(req.params);
  }
  next();
}
