import './util/instrumentation';

import { RunAgentProcess } from './agent';
import { environment } from './util/environment';
import { OpenTelemetry } from './util/instrumentation';
import { logger } from './util/logger';

if (!process.env['CRUISER_AGENT_ID'].trim()) {
    logger.fatal({ msg: "Missing agent ID!" });
    process.exit(1);
}

try {
    RunAgentProcess(environment.jobInstanceId)
        .then(async () => {
            await OpenTelemetry.exporter?.shutdown();
            process.exit(0);
        })
        .catch(async ex => {
            await OpenTelemetry.exporter?.shutdown();
            console.error(ex);
            process.exit(1);
        });
}
catch(ex) {
    logger.fatal(ex);
}
