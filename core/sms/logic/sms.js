const event = require(`../../../util/event`);
const es = require(`../../../util/es`);
const moment = require(`moment`);
const { v4: uuidv4 } = require(`uuid`);

function getCodeFromContent(text) {
  const regex = /(?<!\d)\d{4}(?!\d)|(?<!\d)\d{6}(?!\d)/; // 匹配 6 位连续数字
  const match = text.match(regex);

  if (match) {
    return match[0]; // 输出: 123456
  } else {
    return undefined;
  }
}

module.exports = {
  run: () => {
    event.sub(`sms.go`, async ({ data }) => {
      console.log(`收到短信数据`);
      console.log(data);
      try {
        
        const doc = {
          receiver:data.receiver.replace(/\D/g, ''),
          sender:data.sender.replace(/\D/g, ''),
          time: moment().valueOf(),
          content:data.content,
          id: uuidv4().replace(/-/g, "")
        };

        const code = getCodeFromContent(data.content);

        if (!code) {
          await es.index(`trash`, doc);
          return;
        }

        doc.code = code;

        // 本地落盘
        es.index(`sms`, doc);

        // 通知前端
        const s = require(`./sender`);
        const senders = s.getSenders();
        for (let item of senders) {
          if (item.id == data.sender) {
            const ws = require(`../../../util/ws`);
            ws.send(JSON.stringify(doc));
            break;
          }
        }

      } catch (e) {
        console.log(`分解数据时发生错误`);
        console.error(e);
      }
    });

    event.sub(`sms`, async ({ data }) => {
      console.log(`收到短信数据`);
      console.log(data);
      try {
        const { msg, pos } = data;
        // const arr = msg.split(`┇`);
        const arr = msg.split(`œ`);
        const type = arr[0];
        const receiver = arr[1].replace(/\D/g, '');
        const sender = arr[2];
        const time = arr[3];
        const content = arr[4];
        const doc = {
          type,
          receiver,
          sender,
          pos,
          time: moment().valueOf(),
          origin_time: time,
          content,
          id: uuidv4().replace(/-/g, ""),
        };

        const code = getCodeFromContent(content);

        if (!code) {
          await es.index(`trash`, doc);
          return;
        }

        doc.code = code;

        // 本地落盘
        es.index(`sms`, doc);

        // 通知前端
        const s = require(`./sender`);
        const senders = s.getSenders();
        for (let item of senders) {
          if (item.id == sender) {
            const ws = require(`../../../util/ws`);
            ws.send(JSON.stringify(doc));
            break;
          }
        }

        // 解析机房
        let com = undefined;
        if (type.startsWith(`+NEW_SMS`)) {
          const arr = type.split(`:`);
          com = arr[1];
        }
        es.patch(`person`, { id: receiver, pos, com });
      } catch (e) {
        console.log(`分解数据时发生错误`);
        console.error(e);
      }
    });

    event.sub(`sms.search`, async ({ data }) => {
      const { current, pageSize, keyword } = data ?? {};
      const sort = es.sort({ time: `desc` });
      value = ``;

      const s = require(`./sender`);
      const senders = s.getSenders();
      for (let item of senders) {
        value += `OR ${item.id} `;
      }
      if (value) {
        value = value.substr(3);
      }
      let query = es.query({ sender: value });

      if (keyword) {
        let condition = {};
        condition["sender,receiver"] = `*${keyword}*`;
        query = es.query(condition);
      }
      return await es.search(`sms`, query, sort, current, pageSize);
    });

    event.sub(`trash.search`, async ({ data }) => {
      const { current, pageSize, keyword } = data ?? {};
      const sort = es.sort({ time: `desc` });

      let query;

      if (keyword) {
        let condition = {};
        condition["sender,receiver"] = keyword;
        query = es.query(condition);
      }
      return await es.search(`trash`, query, sort, current, pageSize);
    });

    event.sub(`clean.sms`, async ({ data }) => {
      const ranges = [
        {
          time: { lte: moment().add(-30, "days").valueOf() },
        },
      ];
      const query = es.query({}, { ranges });

      return await es.removeAll(`sms`, query);
    });

    event.sub(`clean.trash`, async ({ data }) => {
      return await es.removeAll(`trash`);
    });

    event.sub(`sms.trash.search`, async ({ data }) => {
      const { current, pageSize } = data;
      const ranges = [
        {
          time: { lte: moment().add(-30, "days").valueOf() },
        },
      ];
      const query = es.query({}, { ranges });
      const sort = es.sort({ time: `desc` });
      return await es.search(`sms`, query, sort, current, pageSize);
    });
  },
};
