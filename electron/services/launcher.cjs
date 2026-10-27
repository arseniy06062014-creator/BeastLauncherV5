const { Client } = require('minecraft-launcher-core');
const paths = require('./paths.cjs');
const store = require('./store.cjs');
const ely = require('./ely.cjs');
const versions = require('./versions.cjs');
const java = require('./java.cjs');

let running = false;

async function play({ loader, mc, ram, autoConnect }, send) {
  if (running) throw new Error('Игра уже запущена');
  const sel = paths.assertSelection({ loader, mc });
  const settings = store.getSettings();
  running = true;

  try {
    send({ type: 'stage', text: 'Проверка аккаунта…' });
    const account = await ely.ensureValid();

    let injector = null;
    if (!account.offline) {
      send({ type: 'stage', text: 'Подготовка Ely.by…' });
      injector = await ely.ensureInjector();
    }

    let forgePath;
    if (sel.loader === 'forge') {
      send({ type: 'stage', text: 'Загрузка Forge…' });
      forgePath = await versions.ensureForge(sel.mc, (p) =>
        send({ type: 'progress', text: 'Загрузка Forge…', percent: Math.round(p * 100) })
      );
    }

    let customId;
    if (sel.loader === 'fabric') {
      send({ type: 'stage', text: 'Подготовка Fabric…' });
      customId = await versions.ensureFabric(sel.mc);
    }

    const javaPath = await java.resolveJava(settings.javaPath, sel.mc, send);

    const dir = paths.ensure(paths.instanceDir(sel));
    paths.ensure(paths.modsDir(sel));
    const ramMb = Math.max(1, Number(ram) || settings.ram) * 1024;

    const options = {
      authorization: {
        access_token: account.offline ? account.uuid : account.accessToken,
        client_token: account.offline ? account.uuid : account.clientToken,
        uuid: account.uuid,
        name: account.name,
        user_properties: '{}',
        meta: { type: 'mojang', demo: false },
      },
      root: paths.ensure(paths.gameRoot()),
      javaPath,
      version: {
        number: sel.mc,
        type: await versions.getVersionType(sel.mc),
        ...(customId ? { custom: customId } : {}),
      },
      forge: forgePath,
      memory: { max: String(ramMb), min: String(Math.min(2048, ramMb)) },
      customArgs: injector ? [`-javaagent:${injector}=ely.by`] : [],
      overrides: { gameDirectory: dir, cwd: dir },
    };

    if (autoConnect) {
      const target =
        settings.servers.find((s) => s.address === settings.autoConnectServer) || settings.servers[0];
      if (target) {
        const [host, port] = target.address.split(':');
        options.server = { host, port: port || '25565' };
      }
    }

    const launcher = new Client();
    let started = false;

    launcher.on('progress', (e) => {
      if (e && e.total) {
        send({
          type: 'progress',
          text: 'Загрузка файлов игры…',
          percent: Math.min(100, Math.round((e.task / e.total) * 100)),
        });
      }
    });
    launcher.on('data', () => {
      if (!started) {
        started = true;
        send({ type: 'started' });
      }
    });
    launcher.on('close', (code) => {
      running = false;
      send({ type: 'closed', code });
    });

    send({ type: 'stage', text: 'Запуск игры…' });
    const proc = await launcher.launch(options);
    if (!proc) {
      throw new Error('Не удалось запустить Java. Проверьте Java в Настройках.');
    }
    return { started: true };
  } catch (e) {
    running = false;
    throw e;
  }
}

module.exports = { play };
