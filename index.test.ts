import { test, expect, beforeAll } from "bun:test";
import { initRpcClient } from "./package/client";
import { initRpcServer, procedure } from "./package/server";
import { Server } from "http";
import { z } from "zod";
import { WebSocket, WebSocketServer } from "ws";
import { randomBytes } from "crypto";

//create a websocket and import from the folders

let httpserver;
let wss;

let requests: Map<string, { request: Request }>;


let things = new Map<string, string>();

type Router = typeof router;
const router = {
    purefunction: procedure(z.object({ name: z.string() }), ({ name },) => {
        return "hello " + name;
    }),
    sideeffects: {
        setter: procedure(z.object({ id: z.string(), thing: z.string() }), ({ id, thing }, clientid): void => {
            things.set(id, thing);
        }),
        getter: procedure(z.object({ id: z.string() }), ({ id }, clientid): string => {
            const thing = things.get(id);
            if (thing) {
                return thing;

            }
            throw new Error("item does not exist");
        })
    },

    asyncsideeffects: {
        setter: procedure(z.object({ id: z.string(), thing: z.string() }), async ({ id, thing }, clientid) => {
            things.set(id, thing);
        }),
        getter: procedure(z.object({ id: z.string() }), async ({ id }, clientid) => {
            const thing = things.get(id);
            if (thing) {
                return thing;
            }
            throw new Error("item does not exist");
        })
    }

}

let websocket;

let serverfunctions: Router;

beforeAll(() => {
    httpserver = new Server();
    wss = new WebSocketServer({ server: httpserver });
    httpserver.listen(3000);
    requests = new Map();
    wss.on("connection", (ws, request) => {
        const id = randomBytes(32).toString("hex");
        //do some connections and stuff
        initRpcServer(ws, router, id);
        ws.onclose = (e) => {
            requests.delete(id);
        };
    });
    websocket = new WebSocket("ws://localhost:3000");
    serverfunctions = initRpcClient(websocket);
    things = new Map();
});

test("pure function", async () => {
    expect(await serverfunctions.purefunction({ name: "myname" })).toEqual("hello myname");
});

test("functions with side effects", async () => {
    await serverfunctions.sideeffects.setter({ id: "0", thing: "this is a thing" });
    expect(await serverfunctions.sideeffects.getter({ id: "0" })).toEqual("this is a thing");
});

test("functions with side effects", async () => {
    await serverfunctions.asyncsideeffects.setter({ id: "0", thing: "this is a thing" });
    expect(await serverfunctions.asyncsideeffects.getter({ id: "0" })).toEqual("this is a thing");
});
