import Sardine from '../../lib';
import { events } from '../../lib/events';

function init(config, cwd) {
  const sardine = new Sardine();

  sardine.on(events.INIT_NOOP, sardine.onInitNoop);
  sardine.on(events.INIT_SUCCESS, sardine.onInitSuccess);

  return sardine.init(config, cwd);
}

export default init;
