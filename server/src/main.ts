import "./types/cruiser-types";
import dotenv from 'dotenv';

dotenv.config({});
dotenv.config({ path: "../.env" });

import { environment } from './util/environment';
import { AsciiBanner } from './util/motd';
import { connectToSurreal } from './util/db';
import { startRestServer } from './rest-server';
import { startWebsocketServer } from './ws-server';
import { InitDatabase } from './startup/init-database';

const isDedicatedSocketService = !!process.env['SOCKET_LISTENER'];

(async() => {
    /**
     * Perform preflight checks
     */
    await connectToSurreal();

    /**
     * Preload records in the database
     */
    await InitDatabase();

    // If running as a dedicated socket instance, create
    // an otherwise empty server.
    // Also runs the schedulers in the same process.
    if (isDedicatedSocketService) {
        startWebsocketServer();
    }
    // Running as a clustered worker.
    else if (environment.is_production) {
        startRestServer();
    }
    // Development mode, run both API server and socket server.
    else {
        startRestServer().then(server => {
            startWebsocketServer(server);
        })
    }
})();

