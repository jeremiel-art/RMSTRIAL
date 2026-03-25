import winston from 'winston';
import { config } from './config.js';

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

const consoleFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, service, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}]${service ? ` [${service}]` : ''}: ${message}${metaStr}`;
  })
);

const jsonFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

export const logger = winston.createLogger({
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  defaultMeta: { service: 'rate-shopper' },
  format: jsonFormat,
  transports: [
    new winston.transports.Console({
      format: config.NODE_ENV === 'production' ? jsonFormat : consoleFormat,
    }),
  ],
});

export function createChildLogger(context: Record<string, unknown>): winston.Logger {
  return logger.child(context);
}
