export const environment = Object.seal({
    namespace: process.env['CRUISER_BLOBSTORE_PATH'],
    log_dir: (process.env['CRUISER_AGENT_LOG_PATH'] || __dirname + "/../../../../data") + "/log",
    blob_dir: (process.env['CRUISER_BLOB_PATH'] || __dirname + "/../../../../data") + "/",

})
