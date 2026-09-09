import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const getEnvOrThrowError = (env: string): string => {
  const value = process.env[env];
  if (value === undefined || !value) {
    throw new Error(`Required environment variable ${env} missing`);
  }

  return value;
};

function getEnvOrUseDefault(env: string, defaultValue: string): string {
  return process.env[env] || defaultValue;
}

const config = {
  port: process.env.PORT || getEnvOrUseDefault('SERVER_PORT', '3000'),
  trafikverketApiKey: getEnvOrThrowError('TRAFIKVERKET_API_KEY'),
  logLevel: getEnvOrUseDefault(
    'LOG_LEVEL',
    process.env.npm_lifecycle_event === 'test' ? 'silent' : 'info'
  ),
  /** Loki push base URL, e.g. http://loki.railway.internal:3100. Unset = stdout only. */
  lokiUrl: process.env.LOKI_URL?.trim() || undefined,
};

export default config;
