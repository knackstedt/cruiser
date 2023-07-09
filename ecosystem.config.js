module.exports = [{
    script: 'dist/server/main.js',
    name: 'dot-ops',
    exec_mode: 'cluster',
    instances: '1',
    port: 3000
}]
