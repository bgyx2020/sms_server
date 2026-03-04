module.exports = {
  run: async () => {
  
    const es = require(`../../util/es`);
    await es.initIndex(`sms`);
    await es.initIndex(`sender`);
    await es.initIndex(`trash`);
    // dd
  },
};
