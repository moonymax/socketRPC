function qmessage(message: any, socket: any, queue: any[]) {
    if (!socket.readyState) {
        queue.push(JSON.stringify(message));
        return;
    }
    queue.forEach((qdmessage: any) => {
        socket.send(qdmessage);
    });
    socket.send(JSON.stringify(message));
}
function createRecursiveProxy(
    connectionUID: string,
    requestid: { value: number },
    callbacks: Map<string, any>,
    socket: any,
    queue: any[],
    callpath: string[]
): any {
    return new Proxy(() => { }, {
        get(target, prop) {
            //if (typeof prop === "symbol") return createRecursiveProxy(callpath);
            return createRecursiveProxy(
                connectionUID,
                requestid,
                callbacks,
                socket,
                queue,
                [...callpath, prop.toString()]
            );
        },
        apply(target, dontknow, args) {
            //make the rpc call
            const id = connectionUID + requestid.value.toString();
            const message = {
                requestid: id,
                callpath,
                args: args[0],
            };

            const promise = new Promise((resolve, reject) => {
                callbacks.set(id, { resolve, reject });
                //TODO set a timeout which will cleanup the callback
            });
            requestid.value++;

            qmessage(message, socket, queue);
            //create a promise and store its resolve and reject methods
            //in a key value store with request id of the message
            return promise;
        },
    });
}
function openHandler(queue: any[], socket: any) {
    //handle the socket opening
    //send all the qed messages
    queue.forEach((message: any) => {
        socket.send(message);
    });
}
function serverResponseHandler(event: MessageEvent, callbacks: Map<string, any>) {
    const data = JSON.parse(event.data);

    const { responseid, response, error } = data;

    if (!responseid) {
        return;
    }

    if (!callbacks.has(responseid)) {
        //response belongs to a different rpc client
        //dont know what to do here
        return;
    }

    const { resolve, reject } = callbacks.get(responseid);
    if (error) {
        reject(new Error(error));
        callbacks.delete(responseid);
        return;
    }

    resolve(response);
    callbacks.delete(responseid);
}
export function initRpcClient<T>(socket: any, connectionUID: string = "main") {
    let requestid = { value: 0 };
    let queue: any = [];
    let callbacks = new Map<string, any>();
    function pingpong() {
        setTimeout(() => {
            socket.send(JSON.stringify({ msg: "ping" }));
            pingpong();
        }, 50000);
    }
    socket.addEventListener("open", () => {
        openHandler(queue, socket);
        pingpong();
    });

    socket.addEventListener("message", (event: MessageEvent) => {
        serverResponseHandler(event, callbacks);
    });

    let proxy: T = createRecursiveProxy(
        connectionUID,
        requestid,
        callbacks,
        socket,
        queue,
        []
    );
    return proxy;
}
