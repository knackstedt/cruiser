export const environment = Object.seal({
    namespace: process.env['CRUISER_BLOBSTORE_PATH'],
    log_dir: (process.env['CRUISER_AGENT_LOG_PATH'] || __dirname + "/../../../../data") + "/log",
    blob_dir: (process.env['CRUISER_BLOB_PATH'] || __dirname + "/../../../../data") + "/",

    is_production: process.env["NODE_ENV"]?.toLowerCase() == "production",


    surreal_url: process.env['SURREAL_URL'],
    surreal_user: process.env['SURREAL_USER'],
    surreal_pass: process.env['SURREAL_PASSWORD'],
    express_session_secret: process.env['SESSION_SECRET'],
    surreal_session_database: "cruiser",
    surreal_session_namespace: "dotglitch",
    surreal_session_table: "user_sessions"
})
