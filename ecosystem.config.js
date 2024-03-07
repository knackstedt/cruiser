module.exports = [{
    script: '/app/server/main.js',
    name: 'cruiser',
    exec_mode: 'cluster',
    instances: '1',
    port: 3000
}]
