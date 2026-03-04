let es_client = null;
let indices = ``; // 用于存储所有初始化的索引 方便在备份和还原的时候传参
/*
1.
执行备份需要先改文件 elasticsearch-8.15.0\config\elasticsearch.yml
加入备份路径 设置 
path.repo: ["F:/es/backup"]
2.
创建快照备份
PUT /_snapshot/my_backup
{
  "type": "fs",
  "settings": {
    "location": "F:/es/backup""
  }
}
3.
备份
PUT /_snapshot/my_backup/test_1
{
  "indices": "index_1,index_2"
}
4.
还原
PUT /_snapshot/my_backup/test_1/_restore
{
  "indices": "index_1,index_2"
}
5.
查询
GET /_cat/snapshots
返回的格式是字符串

6.
删除
DELETE /_snapshot/my_backup/test_1
*/

async function getSnapshots() {
  const client = getClient();
  const ret = await client.cat.snapshots();
  const arr = ret.split(`\n`);
  const res = [];
  for (let item of arr) {
    if (item === "") continue;
    const arr_item = item.split(" ");
    res.push({
      name: arr_item[0],
      time: arr_item[3],
    });
  }
  return res;
}

async function snapshots() {
  const client = getClient();
  const moment = require(`moment`);
  const snapshot = moment().valueOf();
  await client.snapshot.create({ repository: `my_backup`, snapshot, indices });
}

async function removeSnapshots(name) {
  const client = getClient();
  await client.snapshot.delete({ repository: `my_backup`, snapshot: name });
}

async function restore(name) {
  const client = getClient();
  const arr = indices.split(`,`);
  for (let item of arr) {
    await client.indices.close({ index: item });
  }
  await client.snapshot.restore({
    repository: `my_backup`,
    snapshot: name,
    indices,
  });
  for (let item of arr) {
    await client.indices.open({ index: item });
  }
}

function getClient() {
  if (es_client) return es_client;
  const elasticsearch = require("@elastic/elasticsearch");
  const client = new elasticsearch.Client({
    node: `https://43.155.165.189:9200`,
    auth: {
      username: `elastic`,
      password: `lZ9Fng_+D5MSb7wg3TM-`,
    },
    tls: {
      ca: `d0ab6025ebeb6c8cad6043633cfc94951c5dbd36bab8280dde6bc491ab0b8797`,
      rejectUnauthorized: false,
    },
  });
  es_client = client;
  return client;
}

async function index(index, doc) {
  const client = getClient();
  await client.index({
    index,
    id: doc.id,
    body: doc,
    refresh: true,
  });
}

async function post(index, doc) {
  // 验证是否有id
  if (doc.id === undefined) {
    throw { code: `000101`, errorMessage: `数据中必须包含ID` };
  }

  // 验证 id 是否已存在
  const ret = await get(index, doc.id);
  if (ret !== undefined) {
    throw { code: `000102`, errorMessage: `ID为${doc.id}数据已存在` };
  }

  const client = getClient();
  await client.index({
    index,
    id: doc.id,
    body: doc,
    refresh: true,
  });
}

async function put(index, doc) {
  // 验证是否有id
  if (doc.id === undefined) {
    throw { code: `000103`, errorMessage: `数据中必须包含id` };
  }

  // 验证 id 是否不存在
  const ret = await get(index, doc.id);
  if (ret === undefined) {
    throw { code: `000104`, errorMessage: `ID为${doc.id}数据不存在` };
  }

  const client = getClient();
  await client.index({
    index,
    id: doc.id,
    body: doc,
    refresh: true,
  });
}

async function patch(index, doc) {
  // 验证是否有id
  if (doc.id === undefined) {
    throw { code: `000103`, errorMessage: `数据中必须包含id` };
  }

  // 验证 id 是否不存在
  const ret = await get(index, doc.id);
  if (ret === undefined) {
    throw { code: `000104`, errorMessage: `ID为${doc.id}数据不存在` };
  }

  const client = getClient();
  await client.index({
    index,
    id: doc.id,
    body: { ...ret, ...doc },
    refresh: true,
  });
}

async function bulk(index, datas) {
  const client = getClient();
  const body = [];
  for (let data of datas) {
    body.push({ index: { _index: index, _id: data.id } });
    body.push(data);
    if (body.length >= 100) {
      await client.bulk({ refresh: true, body });
      body.splice(0, body.length);
    }
  }
  await client.bulk({ refresh: true, body });
}

async function remove(index, id) {
  const client = getClient();
  await client.delete({ index, id, refresh: true });
}

async function removeAll(index, query) {
  const client = getClient();
  if (!query) {
    query = { match_all: {} };
  }
  client.deleteByQuery({
    index,
    query,
    refresh: true,
    wait_for_completion: false
  });
}

async function initIndex(index, initData, initType = {}) {
  const client = getClient();
  if (indices === ``) indices = index;
  else indices += `,` + index;
  const exists = await client.indices.exists({ index });
  if (exists) return;

  await client.indices.create({
    index,
    body: {
      settings: {
        number_of_shards: 1,
      },
      mappings: {
        dynamic_templates: [
          {
            strings: {
              match_mapping_type: `string`,
              mapping: {
                type: `keyword`,
              },
            },
          },
          {
            ids: {
              match: `id`,
              mapping: {
                type: `keyword`,
              },
            },
          },
        ],
        properties: {
          id: {
            type: `keyword`,
          },
          ...initType,
        },
      },
    },
  });

  if (initData == undefined) return;
  const body = [];
  for (let data of initData) {
    body.push({ index: { _index: index, _id: data.id } });
    body.push(data);
    if (body.length % 100 == 1) {
      await client.bulk({ refresh: true, body });
      body.splice(0, body.length);
    }
  }
  await client.bulk({ refresh: true, body });
}

async function get(index, id) {
  const client = getClient();
  try {
    const doc = await client.get({ index, id });
    return doc._source;
  } catch (err) {
    return undefined;
  }
}

async function all(index, query, sort) {
  // 默认_id排序
  if (sort === undefined) {
    sort = [{ id: `ASC` }];
  }
  const client = getClient();
  const ret = await client.search({
    index,
    body: { query, sort },
    size: 10000,
  });
  for (let item of ret.hits.hits) {
    if (!item._source.id) item._source.id = item._id;
  }
  return ret.hits.hits.flatMap((doc) => doc._source);
}

async function search(index, query, sort, current = 1, pageSize = 10, _source) {
  // 默认_id排序
  if (sort === undefined) {
    sort = [{ id: `ASC` }];
  }
  const from = (current - 1) * pageSize;
  const size = pageSize;
  const client = getClient();
  const ret = await client.search({
    index,
    body: { _source, query, sort },
    size,
    from,
  });
  for (let item of ret.hits.hits) {
    if (!item._source.id) item._source.id = item._id;
  }
  return {
    total: ret.hits.total.value,
    items: ret.hits.hits.flatMap((doc) => doc._source),
  };
}

async function check(index, query) {
  const client = getClient();
  if (process.env.ES_MODULE) index = process.env.ES_MODULE + `_` + index;
  const ret = await client.search({
    index,
    body: { query },
  });

  if (ret.hits.total.value === 0) return undefined;
  else return ret.hits.hits.flatMap((doc) => doc._source)[0];
}

function query(condition, other) {
  const lodash = require(`lodash`);
  const filter = [];
  lodash.mapKeys(condition, (value, key) => {
    const arr = key.split(`,`);
    const fields = [];
    for (let item of arr) {
      fields.push(item);
    }
    if (value) filter.push({ query_string: { fields, query: value } });
  });
  if (other) {
    const { range } = other;
    if (range) filter.push({ range });
    const { ranges } = other;
    if (ranges)
      for (let range of ranges) {
        filter.push({ range });
      }
  }
  const query = { bool: { filter } };
  return query;
}
function bool(list) {
  const lodash = require(`lodash`);
  const query = { bool: {} };
  lodash.map(list, (v, k) => {
    query.bool[k] = lodash.map(v, (v0, k0) => {
      return {
        query_string: {
          default_field: k0,
          query: v0,
        },
      };
    });
  });

  return query;
}

function sort(condition) {
  const lodash = require(`lodash`);
  const sort = [];
  lodash.mapKeys(condition, (value, key) => {
    let item = {};
    item[key] = { order: value };
    sort.push(item);
  });

  return sort;
}

function agg(condition) {
  const lodash = require(`lodash`);
  const ret = {};
  lodash.mapKeys(condition, (value, key) => {
    ret[key] = {
      sum: {
        field: value,
      },
    };
  });
  return ret;
}

async function initData(index, doc) {
  const client = getClient();
  if (process.env.ES_MODULE) index = process.env.ES_MODULE + `_` + index;
  const ret = await get(index, doc.id);
  if (ret) return;

  await client.index({
    index,
    id: doc.id,
    body: doc,
  });
}

module.exports = {
  getClient,
  query,
  sort,
  agg,
  initIndex,
  get,
  index,
  remove,
  all,
  search,
  check,
  bool,
  initData,
  removeAll,
  post,
  put,
  patch,
  bulk,
  getSnapshots,
  snapshots,
  removeSnapshots,
  restore,
};
