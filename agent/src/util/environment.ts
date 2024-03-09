export default {
    cruiserUrl: process.env['CRUISER_CLUSTER_URL'],
    surrealNamespace: process.env['DOTGLITCH_DOTOPS_CLUSTER_NAMESPACE']?.trim() || 'dotglitch',
    agentId: process.env['CRUISER_AGENT_ID'],
    cruiserToken: process.env['CRUISER_SERVER_TOKEN'],
    freezePollInterval: parseInt(process.env['DOTOPS_FREEZE_POLL_INTERVAL'] || '5000'),
    buildDir: process.cwd() + '/build'
}
