import assert from 'assert';

import Migrations from '../../../lib/migrations.jsx';
import errors from '../../../lib/errors.jsx';

describe('sqlite3-migrations', () => {
  let migrations;
  const config = require('../../testConfig/sqlite3');

  describe('#up()', () => {
    it('should throw when the batch is empty', () => {
      migrations = new Migrations(config);
      assert.throws(() => {
        migrations.up({ batch: [], recorded: [] });
      }, errors.EmptyBatchError);
    });

    it('should create the given tables', (done) => {
      migrations = new Migrations(config);
      const batch = [
        {
          name: 'v1',
          checksum: 'v1_checksum',
          steps: 3,
          up: {
            files: [
              { filename: '01_foo.sql', contents: 'CREATE TABLE foo1("id" INTEGER PRIMARY KEY AUTOINCREMENT);' },
              { filename: '02_foo.sql', contents: 'CREATE TABLE foo2("id" INTEGER PRIMARY KEY AUTOINCREMENT);' },
              { filename: '03_foo.sql', contents: 'CREATE TABLE foo3("id" INTEGER PRIMARY KEY AUTOINCREMENT);' },
            ],
          },
        },
      ];
      migrations.discovered = batch;
      migrations.up({ batch, recorded: [] })
        .then(() => migrations.model.driver.query('SELECT 1 from foo1, foo2, foo3'))
        .then(() => done())
        .catch(done);
    });
  });

  describe('#down()', () => {
    it('should throw when the batch is empty', () => {
      migrations = new Migrations(config);
      assert.throws(() => {
        migrations.down({ batch: [], recorded: [] });
      }, errors.EmptyBatchError);
    });
  });
});