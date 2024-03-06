export default {
    dotopsUrl: process.env['DOTGLITCH_DOTOPS_CLUSTER_URL'],
    surrealNamespace: process.env['DOTGLITCH_DOTOPS_CLUSTER_NAMESPACE']?.trim() || 'dotglitch',
    agentId: process.env['DOTGLITCH_AGENT_ID'],
    dotopsToken: process.env['DOTGLITCH_DOTOPS_CLUSTER_TOKEN'],
    freezePollInterval: parseInt(process.env['DOTOPS_FREEZE_POLL_INTERVAL'] || '5000'),
    webserverToken: process.env['DOTOPS_WEBSERVER_TOKEN'],
    buildDir: process.cwd() + '/build'
}
