const env = require("./env");
const WebSocket = require("ws");
// import { WebSocket } from 'ws';

const connect = (pod) => {
    const podUrl = `wss://${env.KUBERNETES_HOST}/api/v1/namespaces/${env.KUBERNETES_NAMESPACE}/pods/${pod}/exec?command=sh&stdin=true&stdout=true&tty=true`;

    return new WebSocket(podUrl, {
        ws: true,
        headers: {
            Authorization: `Bearer ${env.KUBERNETES_SERVICE_ACCOUNT_TOKEN}`,
        },
        rejectUnauthorized: false,
    });
};

const stdin = (characters) => {
    return Buffer.from(`\x00${characters}`, "utf8");
};

const wssServer = new WebSocket.Server({
    noServer: true,
});

exports.setupSocket = (server) => {
    server.on("upgrade", (request, socket, head) => {
        // let { pod } = url.parse(request.url, true).query;
        // const podSocket = connect(pod);
        wssServer.handleUpgrade(request, socket, head, (ws) => {
            // wssServer.emit("connection", ws, podSocket);
        });
    });

    wssServer.on("connection", (ws, podSocket) => {
        podSocket.on("error", (error) => {
            console.log(error);
            ws.send(error.toString());
        });

        podSocket.on("close", () => {
            console.log("[!] k8s socket closed");
            wssServer.close();
        });

        ws.on("close", () => {
            const closeShell = () => {
                const state = podSocket.readyState;
                if (state === 0) {
                    setTimeout(closeShell, 1000);
                    return;
                }
                if (state === 2 || state === 3) {
                    return;
                }
                // Exists current shell to prevent zombie processes
                podSocket.send(stdin("exit\n"));
                podSocket.close();
            };

            closeShell();
            console.log("[!] client connection closed");
        });

        podSocket.on("open", () => {
            podSocket.on("message", (data) => {
                ws.send(data.toString());
            });
            ws.on("message", (message) => {
                podSocket.send(stdin(message));
            });
        });
    });
};
