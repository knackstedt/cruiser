import "./types/cruiser-types";
import dotenv from 'dotenv';

dotenv.config({});
dotenv.config({ path: "../.env" });

import { environment } from './util/environment';
import { AsciiBanner } from './util/motd';
import { connectDatabase } from './util/db';
import { startRestServer } from './rest-server';
import { startWebsocketServer } from './ws-server';

const isDedicatedSocketService = !!process.env['SOCKET_LISTENER'];

/**
 * Perform preflight checks
 */
(async() => {
    await connectDatabase();
})();

// If running as a dedicated socket instance, create
// an otherwise empty server.
// Also runs the schedulers in the same process.
if (isDedicatedSocketService) {
    console.log(AsciiBanner);
    startWebsocketServer();
}
// Running as a clustered worker.
else if (environment.is_production) {
    startRestServer();
}
// Development mode, run both API server and socket server.
else {
    startRestServer().then(server => {
        console.log(AsciiBanner);
        startWebsocketServer(server);
    })
}
