const WebSocket = require("ws");

let wss = null;
let clients = [];
function init() {
  wss = new WebSocket.Server({ port: 3001 });
  wss.on("connection", (ws) => {
    // const clientId = Math.random().toString(16).substring(2);
    // console.log(`Client connected with id: ${clientId}`);

    // console.log(wss.clients);
    // // 将客户端的WebSocket实例和ID存储在一个对象中
    // wss.clients.set(clientId, ws);

    // // 监听客户端的消息
    // ws.on("message", (message) => {
    //   console.log(
    //     `Received message: ${message} from client with id: ${clientId}`
    //   );
    // });

    // // 当客户端断开连接时
    // ws.on("close", () => {
    //   console.log(`Client with id: ${clientId} has disconnected`);
    //   wss.clients.delete(clientId);
    // });
  });
}

function send(message) {
  wss.clients.forEach((clientWS) => {
    if (clientWS.readyState === WebSocket.OPEN) {
      clientWS.send(message);
    }
  });
}

module.exports = {
  init,
  send,
};
