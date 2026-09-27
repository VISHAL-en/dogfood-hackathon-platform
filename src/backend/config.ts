import path from 'path';

export interface AppConfig {
  port: number;
  dbPath: string;
  nodeEnv: string;
  frontendDistPath: string;
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  dbPath: process.env.DB_PATH || path.resolve(process.cwd(), 'data', 'dogfood.sqlite'),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendDistPath: process.env.FRONTEND_DIST_PATH || path.resolve(process.cwd(), 'dist', 'public')
};
