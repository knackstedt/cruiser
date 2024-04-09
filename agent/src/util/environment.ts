import os from 'os';

export const environment = {
    cruiserUrl: process.env['CRUISER_CLUSTER_URL'],
    surrealNamespace: process.env['DOTGLITCH_DOTOPS_CLUSTER_NAMESPACE']?.trim() || 'dotglitch',
    cruiserToken: process.env['CRUISER_SERVER_TOKEN'],
    freezePollInterval: parseInt(process.env['DOTOPS_FREEZE_POLL_INTERVAL'] || '5000'),
    buildDir: process.cwd() + '/build/',
    jobInstanceId: `job_instance:` + process.env['CRUISER_AGENT_ID'].toUpperCase(),
    agentIsWindowsHost: os.platform() == "win32",
    is_production: process.env['NODE_ENV'] == "production"
}
