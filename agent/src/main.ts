import './util/instrumentation';

import { logger } from './util/logger';
import { RunAgentProcess } from './agent';
import { environment } from './util/environment';
import { OpenTelemetry } from './util/instrumentation';

if (
    !process.env['CRUISER_AGENT_ID'] ||
    !/^[0-7][0-9A-Z]{25}$/i.test(process.env['CRUISER_AGENT_ID'].toUpperCase())
) {
    logger.fatal({ message: "Invalid agent identifier!"})
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
    logger.error(ex);
    debugger;
}
