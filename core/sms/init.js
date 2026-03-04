module.exports = {
  run: async () => {
    const sender = require(`./logic/sender`);
    sender.refresh();
  },
};
