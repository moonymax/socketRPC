import { z } from "zod";
const AsyncFunction = (async () => { }).constructor;
const GeneratorFunction = function*() { }.constructor;

function isAsync<FnType>(asyncFn: FnType) {
    if (
        (asyncFn instanceof AsyncFunction &&
            AsyncFunction !== Function &&
            AsyncFunction !== GeneratorFunction) === true
    ) {
        return true;
    }
    return false;
}
export function procedure<Input, Result>(
    schema: z.Schema<Input>,
    fn: (
        input: z.infer<typeof schema>,
        clientContext: string
    ) => Promise<Result> | Result
) {
    return async (
        input: z.infer<typeof schema>,
        clientContext?: string
    ) => {
        //first validate schema

        if (!clientContext) {
            //this is wrapped into a promise for TYPE INFERENCE
            return Promise.reject(new Error("Client has no ID"));
        }
        const validationResult = schema.safeParse(input);
        if (validationResult.success) {
            //maybe catch the error here
            try {
                // fn might be async or not. using await for both
                //this is wrapped into a promise for TYPE INFERENCE
                return Promise.resolve(await fn(input, clientContext));
            } catch (error) {
                //this is wrapped into a promise for TYPE INFERENCE
                return Promise.reject(error);
            }
        } else {
            //this is wrapped into a promise for TYPE INFERENCE
            return Promise.reject(new Error("Invalid arguments"));
        }
    };
}
const rpcschema = z.object({
    requestid: z.string(),
    callpath: z.array(z.string()),
    args: z.any(),
});
async function messagehandler<Router, ClientCTX>(
    event: any,
    socket: any,
    router: Router,
    clientid: ClientCTX
) {
    const data = JSON.parse(event.data);
    if (data?.msg === "ping") {
        socket.send(JSON.stringify({ msg: "pong" }));
    }

    const validationResult = rpcschema.safeParse(data);
    if (!validationResult.success) {
        //message is not of interest. do nothing.
        return;
    }
    const { requestid, callpath, args } = data;

    let routing: any = router;
    for (let i = 0; i < callpath.length; i++) {
        if (routing[callpath[i]] === null) {
            socket.send(
                JSON.stringify({
                    responseid: requestid,
                    response: null,
                    error: "Invalid Callpath",
                })
            );
            return;
        }
        routing = routing[callpath[i]];
    }

    try {
        const response = await (await routing.call(null, args, clientid));
        socket.send(
            JSON.stringify({
                responseid: requestid,
                response,
                error: null,
            })
        );
    } catch (error: any) {
        socket.send(
            JSON.stringify({
                responseid: requestid,
                response: null,
                error: error.message,
            })
        );
    }
}
export function initRpcServer<Router, ClientCTX>(
    socket: any,
    router: Router,
    clientContext: ClientCTX
) {
    const handler = async (event: any) => {
        await messagehandler(event, socket, router, clientContext);
    };

    socket.addEventListener("message", handler);
}
