import os from 'os';

export const environment = {
    cruiserUrl: process.env['CRUISER_CLUSTER_URL'],
    cruiserToken: process.env['CRUISER_SERVER_TOKEN'],
    buildDir: process.cwd() + '/build/',
    jobInstanceId: `job_instance:` + process.env['CRUISER_AGENT_ID'].toUpperCase(),
    agentIsWindowsHost: os.platform() == "win32",
    is_production: process.env['NODE_ENV'] == "production"
}
