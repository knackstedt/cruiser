
import { BasicTracerProvider, BatchSpanProcessor, ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import {
    diag,
    DiagConsoleLogger,
    DiagLogLevel,
} from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import * as pkg from '../../package.json';

// TODO: prove which level should be enabled
if (process.env['NODE_ENV'] != "production") {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);
}

const exporter = new OTLPTraceExporter();

const provider = new BasicTracerProvider({
    resource: new Resource({
        [ATTR_SERVICE_NAME]: 'cruiser-agent',
        [ATTR_SERVICE_VERSION]: pkg.version,
    })
});

// This exporter drops data for an unknown reason.
// provider.addSpanProcessor(new BatchSpanProcessor(exporter, {}));

provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
// provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
provider.register();

export const OpenTelemetry = {
    exporter,
    provider
}
