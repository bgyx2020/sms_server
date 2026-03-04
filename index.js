const Koa = require(`koa`);
const app = new Koa();
const fs = require(`fs`);

async function init(params) {
  const cores = fs.readdirSync(__dirname + `/core`);
  for (const dir of cores) {
    const filePath = __dirname + `/core/${dir}/${params}.js`;

    try {
      fs.statSync(filePath);
    } catch {
      // no file
      continue;
    }

    const obj = require(`./core/${dir}/${params}.js`);
    await obj.run();
  }
}

async function logic() {
  const cores = fs.readdirSync(__dirname + `/core`);
  for (const dir of cores) {
    const filePath = __dirname + `/core/${dir}/logic`;

    try {
      fs.statSync(filePath);
    } catch {
      // no file
      continue;
    }

    const logics = fs.readdirSync(filePath);
    for (let logic of logics) {
      const obj = require(filePath + `/` + logic);
      await obj.run();
    }
  }
}

async function cors() {
  const cors = require(`@koa/cors`);
  app.use(cors());
}

async function body() {
  const body = require(`koa-body`);
  app.use(
    body.koaBody({
      multipart: true,
      jsonLimit: `50mb`,
      formLimit: "50mb",
    })
  );
}

async function route() {
  const event = require(`./util/event`);
  app.use(async (ctx) => {
    console.log(ctx.req.method);
    await event.pub(ctx);
  });
  let server = app.listen(3002);
  server.timeout = 5000;
}

async function webSocket() {
  const ws = require(`./util/ws`);
  ws.init();
}

async function run() {
  await init(`ctor`);
  await init(`init`);
  await webSocket();
  await logic();
  await cors();
  await body();
  await route();
  console.log(`启动完成 0.1`);
}

run();
