import program from 'commander';

import commands from './commands';

program
  .version(require('../package.json').version)
  .option('-v, --verbose', 'Display verbose information', false);

program
  .command('init')
  .description('Initialize a new Sardine project')
  .action(commands.init);

program
  .command('compile <suffix>')
  .option('-d, --dir <directory>', 'Target directory')
  .description('Merge up and down steps to single files')
  .action(commands.compile);

program
  .command('create <suffix>')
  .description('Create a new migration directory')
  .action(commands.create);

program
  .command('step <migration> [suffixes...]')
  .description('Create (a) new step(s) in <migration>. Fuzzy searchs migrations by name.')
  .action(commands.step);

program
  .command('update')
  .alias('up')
  .description('Migrate to the database to the latest version')
  .action(commands.update);

program
  .command('rollback')
  .alias('down')
  .description('Revert latest migration. --all to revert all migrations')
  .option('-a, --all', 'Revert every known migration')
  .action(commands.rollback);

program
  .command('current')
  .alias('cur')
  .description('Show current migration')
  .action(commands.current);

program
  .command('*')
  .action(() => program.help());

if(!process.argv.slice(2).length) {
  program.help();
}

program.parse(process.argv);
