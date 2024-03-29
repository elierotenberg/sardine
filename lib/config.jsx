import { stat } from 'fs';
import { resolve } from 'path';

import Promise from 'bluebird';

import { MissingConfiguration } from '../lib/errors';

const statAsync = Promise.promisify(stat);
const SARDINE_CONFIG = 'sardineConfig.js';
const CONFIG_TEMPLATE = `module.exports = {
  directory:  'migrations',
  tableName:  'sardine_migrations',
  driver:     'pg',
  connection: {
    host:     'localhost',
    user:     'postgres',
    password: 'postgres',
    database: 'postgres'
  }
};
`;

function config(path = process.cwd()) {
  const configPath = resolve(path, SARDINE_CONFIG);

  return statAsync(configPath)
    .then(() => require(configPath))
    .catch(() => {
      throw new MissingConfiguration(`${SARDINE_CONFIG} not found in ${path}`);
    });
}

export default {
  CONFIG_TEMPLATE,
  SARDINE_CONFIG,
  config,
};
