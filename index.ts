import { initRpcClient } from "./package/client";
import { initRpcServer, procedure } from "./package/server";
import { Server } from "http";
import { z } from "zod";
import { WebSocket, WebSocketServer } from "ws";
import { randomBytes } from "crypto";

//create a websocket and import from the folders

let httpserver = new Server();
let wss = new WebSocketServer({ server: httpserver });
httpserver.listen(3000);

const requests = new Map<string, { request: Request }>();


wss.on("connection", (ws, request) => {
    const id = randomBytes(32).toString("hex");
    //do some connections and stuff
    initRpcServer(ws, router, id);
    ws.onclose = (e) => {
        requests.delete(id);
    };
});

type Router = typeof router;
const router = {
    greet: procedure(z.object({ name: z.string() }), ({ name },) => {
        console.log("hello " + name);
    })
}

let websocket = new WebSocket("ws://localhost:3000");

const serverfunctions = initRpcClient(websocket);
