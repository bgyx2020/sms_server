const subs = []; // 全部订阅者

async function pub(ctx) {
  const params = { ctx };

  // 将参数装载到body

  params.data = ctx.request.body;

  // 调整消息格式

  const { method, url } = ctx.request;
  const arr = url.split("/");
  let message = ``;
  for (let i = 0; i < arr.length; i++) {
    let tmp = arr[i];
    if (tmp === "") continue;
    message += `.` + tmp;
  }

  message = message.substring(1).toLocaleLowerCase();

  try {
    console.log(message);
    ctx.body = await deal(message, params);
  } catch (err) {
    ctx.status = err.status ?? 500;
    if (err.msg) {
      ctx.body = { ...err };
    } else {
      ctx.body = { msg: err.message };
    }
    console.log(err);
  }
}

async function deal(message, params) {
  let result = {};

  // 前处理
  {
    const filter = subs.filter((v) => {
      const vms = v.message.split(`.`);
      const ms = (message + `.before`).split(`.`);
      if (vms.length != ms.length) return false;
      for (let i = 0; i < vms.length; i++) {
        if (vms[i] == `*`) continue;
        if (vms[i] != ms[i]) return false;
      }
      return true;
    });
    for (let s of filter) {
      await s.run(params, message + `.before`);
    }
  }

  // 处理 message
  {
    const filter = subs.filter((v) => {
      const vms = v.message.split(`.`);
      const ms = message.split(`.`);
      if (vms.length != ms.length) return false;
      for (let i = 0; i < vms.length; i++) {
        if (vms[i] == `*`) continue;
        if (vms[i] != ms[i]) return false;
      }
      return true;
    });
    // 有且仅有一个处理者 如果发现错误 需要记录
    if (filter.length != 1) {
      throw {
        status: 500,
        message: `message:${message}处理者个数为${filter.length},不符合处理者个数要求1个${message}`,
      };
    }
    for (let s of filter) {
      const ret = await s.run(params, message);
      params.result = ret;
    }
  }

  // 处理 extra 消息
  {
    const filter = subs.filter((v) => {
      const vms = v.message.split(`.`);
      const ms = (message + `.extra`).split(`.`);
      if (vms.length != ms.length) return false;
      for (let i = 0; i < vms.length; i++) {
        if (vms[i] == `*`) continue;
        if (vms[i] != ms[i]) return false;
      }
      return true;
    });
    for (let s of filter) {
      const ret = await s.run(params, message + `.extra`);

      if (ret) {
        params.result = { ...params.result, ...ret };
      }
    }
  }

  // 处理 after 消息

  const filter = subs.filter((v) => {
    const vms = v.message.split(`.`);
    const ms = (message + `.after`).split(`.`);
    if (vms.length != ms.length) return false;
    for (let i = 0; i < vms.length; i++) {
      if (vms[i] == `*`) continue;
      if (vms[i] != ms[i]) return false;
    }
    return true;
  });
  for (let s of filter) {
    params.extra = result.data;
    s.run(params, message + `.after`);
  }

  return params.result;
}

function sub(message, run) {
  subs.push({ message, run });
}

function subBefore(message, run) {
  subs.push({ message: message + `.before`, run });
}

function subAfter(message, run) {
  subs.push({ message: message + `.after`, run });
}

function subExtra(message, run) {
  subs.push({ message: message + `.extra`, run });
}

module.exports = {
  sub,
  subBefore,
  subAfter,
  subExtra,
  pub,
};
