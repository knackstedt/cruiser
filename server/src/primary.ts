import cluster, { Worker } from 'cluster';
import os from 'os';
import { logger } from './util/logger';

const cpus = os.cpus().length;

// TODO: Once we know how to share socket.io connections
// across instances, increase this.
const maxWorkers = 1;

const workers: Worker[] = [];

const spawnWorker = () => {
    const worker = cluster.fork();
    logger.info(`Spawned worker ${worker.id}`);

    worker.on("exit", (code, signal) => {
        logger.warn(`Worker ${worker.id} exited with code ${code}`);
        workers.splice(workers.indexOf(worker), 1);

        setTimeout(() => {
            spawnWorker();
        }, 1000);
    })

    workers.push(worker);
}

const spawnSocketWorker = () => {
    let worker = cluster.fork({ SOCKET_LISTENER: 1 });
    logger.info(`Spawned socket worker ${worker.id}`);

    worker.on("exit", (code, signal) => {
        logger.warn(`Socket worker ${worker.id} exited with code ${code}`);

        setTimeout(() => {
            spawnSocketWorker();
        }, 1000);
    });
}

if (cluster.isPrimary) {
    let i = 0;

    const spawn = () => {
        setTimeout(() => {
            if (i++ < Math.min(maxWorkers, cpus)) {
                spawnWorker();
                spawn();
            }
        }, 1000);
    }
    spawn();

    spawnSocketWorker();
}
else {
    // Workers will run the normal webserver service.
    require('./main');
}
