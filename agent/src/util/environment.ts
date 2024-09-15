import os from 'os';

export const environment = {
    cruiserUrl: process.env['CRUISER_CLUSTER_URL'],
    cruiserToken: process.env['CRUISER_SERVER_TOKEN'],
    buildDir: process.env['CRUISER_AGENT_BUILD_DIR'] || (process.cwd() + '/build/'),
    jobInstanceId: `job_instance:` + process.env['CRUISER_AGENT_ID']?.toUpperCase(),
    agentIsWindowsHost: os.platform() == "win32",
    is_production: process.env['NODE_ENV'] == "production",

    agent_metric_cpu_interval: parseInt(process.env['CRUISER_AGENT_METRIC_CPU_INTERVAL'] || '1000'),
    agent_metric_mem_interval: parseInt(process.env['CRUISER_AGENT_METRIC_MEM_INTERVAL'] || '1000'),
    agent_metric_net_interval: parseInt(process.env['CRUISER_AGENT_METRIC_NET_INTERVAL'] || '1000'),
}
