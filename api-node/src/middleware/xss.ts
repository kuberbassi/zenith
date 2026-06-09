import { Request, Response, NextFunction } from 'express';

function sanitizeHtmlString(val: string): string {
  let cleaned = val;
  // 1. Strip script tags
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // 2. Strip event handlers (e.g. onclick, onload)
  cleaned = cleaned.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^>\s]+)/gi, '');
  // 3. Strip javascript: URIs in href/src attributes
  cleaned = cleaned.replace(/\b(href|src)\s*=\s*(['"]?)\s*javascript:[^>\s]*\2/gi, '');
  // 4. Validate iframe sources - only allow youtube and vimeo embeds
  cleaned = cleaned.replace(/<iframe\b[^>]*>/gi, (iframe) => {
    const allowedSrc = /src\s*=\s*(['"]?)\s*https?:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be|player\.vimeo\.com)/i.test(iframe);
    return allowedSrc ? iframe : '';
  });
  return cleaned;
}

function sanitizeValue(val: any, key?: string): any {
  if (typeof val === 'string') {
    if (key === 'content' || key === 'syllabus') {
      return sanitizeHtmlString(val);
    }
    // Strip HTML tags (<...>) and common script tags/handlers
    return val.replace(/<[^>]*>/g, '');
  }
  if (Array.isArray(val)) {
    return val.map(v => sanitizeValue(v, key));
  }
  if (val && typeof val === 'object') {
    const res: Record<string, any> = {};
    for (const k of Object.keys(val)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      res[k] = sanitizeValue(val[k], k);
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
