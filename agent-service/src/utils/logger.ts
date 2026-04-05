import winston from 'winston';
import path from 'path';
import { config } from '../config';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  config.logging.format === 'json' 
    ? winston.format.json() 
    : winston.format.printf(({ timestamp, level, message, ...metadata }) => {
        let msg = `${timestamp} [${level}] : ${message} `;
        if (Object.keys(metadata).length > 0) {
          msg += JSON.stringify(metadata);
        }
        return msg;
      })
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    level: config.logging.level,
    handleExceptions: true
  })
];

// Add file transport if path is specified
if (config.logging.outputPath) {
  transports.push(
    new winston.transports.File({
      filename: path.join(config.logging.outputPath, 'error.log'),
      level: 'error'
    }),
    new winston.transports.File({
      filename: path.join(config.logging.outputPath, 'combined.log')
    })
  );
}

const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports,
  exitOnError: false
});

export default logger;

// Dashboard log buffer hook - will be set by index.ts
let dashboardLogHook: ((level: 'error' | 'warn' | 'info' | 'debug', message: string, metadata?: any, source?: string) => void) | null = null;

export const setDashboardLogHook = (hook: typeof dashboardLogHook) => {
  dashboardLogHook = hook;
};

// Utility functions for structured logging
export const logInfo = (message: string, metadata?: any) => {
  logger.info(message, metadata);
  dashboardLogHook?.('info', message, metadata);
};

export const logError = (message: string, error?: Error | any, metadata?: any) => {
  const errorMeta = { 
    error: error?.message || error, 
    stack: error?.stack,
    ...metadata 
  };
  logger.error(message, errorMeta);
  dashboardLogHook?.('error', message, errorMeta);
};

export const logWarn = (message: string, metadata?: any) => {
  logger.warn(message, metadata);
  dashboardLogHook?.('warn', message, metadata);
};

export const logDebug = (message: string, metadata?: any) => {
  logger.debug(message, metadata);
  dashboardLogHook?.('debug', message, metadata);
};
