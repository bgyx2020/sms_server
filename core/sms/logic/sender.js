const event = require(`../../../util/event`);
const es = require(`../../../util/es`);
let senders = [];

async function refresh() {
  senders = await es.all(`sender`);
}

module.exports = {
  run: () => {
    event.sub(`sender.post`, async ({ data }) => {
      const { id } = data;
      es.index(`sender`, { id });
      refresh();
    });

    event.sub(`sender.all`, async ({ data }) => {
      return es.all(`sender`);
    });

    event.sub(`sender.delete`, async ({ data }) => {
      const { id } = data;
      es.remove(`sender`, id);
      refresh();
    });
  },
  getSenders: () => {
    return senders;
  },
  refresh
};
