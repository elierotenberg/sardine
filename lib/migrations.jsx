import fs from 'fs';
import { basename, resolve, join } from 'path';
import EventEmitter from 'events';

import Promise from 'bluebird';
import co from 'co';
import _ from 'lodash';

import * as filters from './filters';
import { snake } from './date';
import { SARDINE_CONFIG } from './config';
import { IntegrityError, EmptyBatchError, MigrationNotFound, MissingConfiguration } from './errors';
import { checksum, twoDigits } from './util';
import Model from './db/model';

Promise.promisifyAll(fs);

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

export default class Migrations extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.model = new Model(config);
  }

  init(config, cwd) {
    return config
      .then(() => this.emit('init:noop'))
      .catch(MissingConfiguration, () => {
        const path = resolve(cwd, SARDINE_CONFIG);
        return fs.writeFileAsync(path, CONFIG_TEMPLATE)
          .then(() => this.emit('init:success'));
      });
  }

  create(date, suffix) {
    const snakeDate = snake(date);
    const rootDir = `${snakeDate}_${suffix}`;

    return {
      rootDir,
      up: join(rootDir, 'up'),
      down: join(rootDir, 'down'),
    };
  }

  step(migrationName, suffixes) {
    const paths = [];
    const target = _.find(this.discovered, (m) => _.contains(m.name, migrationName));

    if(!target) {
      throw new MigrationNotFound(`Migration "${migrationName}" not found`);
    }

    ['up', 'down'].forEach((direction) => {
      suffixes.forEach((suffix, index) => {
        const filename = `${twoDigits(target.steps + index + 1)}_${suffix}.sql`;
        paths.push(`${join(target.name, direction, filename)}`);
      });
    });

    return paths;
  }

  state(discovered, recorded) {
    const current = filters.current(discovered, recorded);

    return discovered.map((m) => ({
      name: m.name,
      current: m.name === current.name,
    }));
  }

  discover() {
    const { directory } = this.config;
    return fs.readdirAsync(directory).then((dirs) =>
      Promise.all(
        dirs.map((dir) => this.read(resolve(directory, dir)))
      ).then((discovered) => {
        this.discovered = discovered;
        return discovered;
      })
    );
  }

  read(path) {
    const name = basename(path);
    return Promise
      .all([
        fs.readdirAsync(resolve(path, 'up')).then((up) =>
          Promise.all(
            up.map((filename) => this.readFile(resolve(path, 'up'), filename)))
        ),
        fs.readdirAsync(resolve(path, 'down')).then((down) =>
          Promise.all(
            down.map((filename) => this.readFile(resolve(path, 'down'), filename)))
        ),
      ])
      .then((migrations) =>
        Promise.all(migrations).then(([up, down]) => {
          Migrations.checkIntegrity(up, down, name);
          const upSum = this.directionChecksum(up);
          const downSum = this.directionChecksum(down);
          return {
            name,
            up: { files: up, checksum: upSum },
            down: { files: down, checksum: downSum },
            steps: up.length,
            checksum: checksum(upSum, downSum),
          };
        })
      );
  }

  readFile(path, filename) {
    return fs.readFileAsync(resolve(path, filename))
      .then((contents) => ({ filename, contents, checksum: checksum(filename, contents) }));
  }

  directionChecksum(files) {
    let sum = '';
    files.forEach((file) => {
      sum = sum + checksum(file.filename, file.contents.toString());
    });

    return sum === '' ? sum : checksum(sum);
  }

  _isLatest(migration) {
    return _.last(this.discovered).name === migration.name;
  }

  getUpdateBatch() {
    return this
      .discover()
      .then((discovered) =>
        this.model.findAllByName().then((recorded) => {
          const batch = filters.update(discovered, recorded);
          return { recorded, batch };
        }));
  }

  getRollbackBatch(limitToLast) {
    return this
      .discover()
      .then((discovered) =>
        this.model.findLastAppliedMigrations(limitToLast).then((recorded) => {
          const batch = filters.rollback(discovered, recorded);
          batch.reverse();
          return { recorded, batch };
        }));
  }

  up({ batch, recorded }) {
    return this.applyBatch({ batch, recorded, direction: 'up' });
  }

  down({ batch, recorded }) {
    return this.applyBatch({ batch, recorded, direction: 'down' });
  }

  applyBatch({ batch, recorded, direction }) {
    const self = this;

    if(batch.length === 0) {
      throw new EmptyBatchError('Cannot apply empty batch');
    }

    return this.model.connect()
      .then(() => co(function* apply() {
        for (const migration of batch) {
          yield self.applyOne({ migration, recorded, direction });
        }
      }));
  }

  applyOne({ migration, recorded, direction }) {
    this.emit('applyOne', migration);
    const known = _.find(recorded, (rm) => rm.name === migration.name);

    if(!this._isLatest(migration) && known) {
      if(migration.checksum !== known.checksum) {
        throw new IntegrityError(
          `Migration "${migration.name}" has been tampered with, revert it to its previous state before migrating`);
      }
    }

    const batch = migration[direction].files.map((file) => {
      return () => {
        const path = `${migration.name}/${direction}/${file.filename}`;
        this.emit('step', path);
        return this.model.query(file.contents.toString());
      };
    });

    return this.model.transaction(batch)
      .then(() => {
        if(known) {
          return this.model.update({ name: known.name, applied: direction === 'up' });
        }
        return this.model.insert({
          name: migration.name,
          applied: true,
          migration_time: new Date(), // eslint-disable-line camelcase
          checksum: migration.checksum,
        });
      });
  }

  static checkIntegrity(ups, downs, name) {
    _.zip(ups, downs).forEach(([up, down]) => {
      const upFilename = up.filename;
      const downFilename = down.filename;

      if(!down) {
        throw new IntegrityError(
          `${name}/up/${upFilename} has no "down" counterpart, this migration cannot be applied.`);
      }

      if(!up) {
        throw new IntegrityError(
          `${name}/down/${downFilename} has no "up" counterpart, this migration cannot be applied.`);
      }

      if(downFilename !== upFilename) {
        throw new IntegrityError(
           `${downFilename} and ${upFilename} should have the same filename`);
      }
    });
  }
}
