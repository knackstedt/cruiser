const defaultStoragePath = process.env['CRUISER_GLOBAL_STORAGE_PATH'] || (process.cwd() + "/data");

export const environment = Object.seal({
    cruiser_kube_namespace: process.env['CRUISER_KUBE_NAMESPACE'] || process.env['CRUISER_AGENT_NAMESPACE'] || "cruiser",

    // hostname -i => 10.42.1.8
    cruiser_cluster_url: process.env['CRUISER_CLUSTER_URL'],
    cruiser_admin_id: process.env['CRUISER_ADMINISTRATOR'],
    cruiser_scheduler_poll_interval: parseInt(process.env['CRUISER_SCHEDULER_POLL_INTERVAL'] || (1 * 60).toString()),
    cruiser_vault_secret: process.env['CRUISER_VAULT_SECRET'],

    cruiser_rest_port: parseInt(process.env['CRUISER_REST_PORT'] || '6800'),
    cruiser_websocket_port: parseInt(process.env['CRUISER_WEBSOCKET_PORT'] || '6820'),

    cruiser_log_dir: process.env['CRUISER_AGENT_LOG_PATH'] || (defaultStoragePath + "/log"),
    cruiser_blob_dir: process.env['CRUISER_BLOB_PATH'] || (defaultStoragePath + "/blob"),
    cruiser_artifact_dir: process.env['CRUISER_ARTIFACT_PATH'] || (defaultStoragePath + "/artifacts"),
    cruiser_vault_storage_dir: process.env['CRUISER_VAULT_PATH'] || (defaultStoragePath + "/vault"),

    surreal_url: process.env['SURREAL_URL'],
    surreal_user: process.env['SURREAL_USER'],
    surreal_pass: process.env['SURREAL_PASSWORD'],
    surreal_scope: process.env['SURREAL_SCOPE'],
    surreal_cruiser_database: process.env['CRUISER_SURREAL_DATABASE'] || "cruiser",
    surreal_cruiser_namespace: process.env['CRUISER_SURREAL_NAMESPACE'] || "cruiser",

    // Notably; this is the database name **within** a SurrealDB instance.
    express_session_database: process.env['EXPRESS_SESSION_DATABASE'] || "cruiser",
    express_session_namespace: process.env['EXPRESS_SESSION_NAMESPACE'] || "dotglitch",
    express_session_table: process.env['EXPRESS_SESSION_TABLE'] || "user_sessions",
    express_session_secret: process.env['EXPRESS_SESSION_SECRET'] || process.env['SESSION_SECRET'],

    github_client_id: process.env['GITHUB_OAUTH_CLIENTID'],
    github_client_secret: process.env['GITHUB_OAUTH_SECRET'],

    is_production: process.env["NODE_ENV"]?.toLowerCase() == "production",

    is_running_local_agents: process.env["KUBERNETES"]
});
