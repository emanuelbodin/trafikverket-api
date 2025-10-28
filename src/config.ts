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
  port: getEnvOrUseDefault('SERVER_PORT', '3000'),
  trafikverketApiKey: getEnvOrThrowError('TRAFIKVERKET_API_KEY'),
};

export default config;
