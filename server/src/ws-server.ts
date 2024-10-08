import http from 'http';

import { SocketTunnelService } from './singleton/socket-tunnel';
import { CronScheduler } from './util/scheduler';
import { SocketLiveService } from './singleton/watch-database';
import { EventTriggers } from './singleton/watch-jobinstance';
import { SocketEventService } from './singleton/socket-service';
import { environment } from './util/environment';
import { GitWatcher } from './singleton/watch-git';
import { AgentController } from './util/agent-controllers/interface';

/**
 * Startup the websocket endpoint listener
 */
export const startWebsocketServer = (server?: http.Server) => {
    // If we're started in development mode we're provided an already
    // bootstrapped server. Otherwise we'll start on another port in order to
    // support more dynamic scaling
    if (!server) {
        server = http.createServer();
        server.listen(environment.cruiser_websocket_port);
    }

    const sts = new SocketTunnelService(server);
    const sls = new SocketLiveService(server);
    const ses = new SocketEventService(server, sts);

    CronScheduler();
    EventTriggers();
    GitWatcher();

    // Tell the agent controller that we're ready to start watching for running agents
    AgentController.watchRunningAgents();

    // TODO: Enable graceful "disconnect" signal to tell clients
    // that they need to reconnect to a new instance of the app
}
