import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { ResolveSources } from './util/source-resolver';
import { JobDefinition, PipelineDefinition, TaskGroupDefinition } from '../types/pipeline';
import { getSocketLogger } from './socket/logger';
import { api } from './util/axios';
import { sleep } from './util/sleep';
import { orderSort } from './util/order-sort';
import { envSubstitute } from './util/envsubst';
import { getConfig } from './util/config';
import { TripBreakpoint } from './util/breakpoint';
import { getSocketTerminal } from './socket/terminal';
import { getSocket } from './socket/socket';


const validateJobCanRun = async (job: JobDefinition) => {
    const tasks = job.taskGroups?.map(t => t.tasks).flat();
    if (!tasks || tasks.length == 0)
        throw new Error("No work to do");
};


export const RunAgentProcess = async (taskId: string) => {
    const { job, pipeline, kubeTask } = await getConfig(taskId);

    const socket = await getSocket(pipeline, job)
    const logger = await getSocketLogger(socket);
    const terminal = await getSocketTerminal(socket);

    const RunTaskGroupsInParallel = (taskGroups: TaskGroupDefinition[], jobInstance) => {
        taskGroups?.sort(orderSort);

        return Promise.all(taskGroups.map(taskGroup => new Promise(async (r) => {
            try {
                logger.info({
                    msg: `Initiating TaskGroup ${taskGroup.label}`,
                    taskGroup,
                    block: "start"
                });

                const tasks = taskGroup.tasks.sort(orderSort);

                const environment: { key: string, value: string; }[] =
                    await api.get(`/api/jobs/${jobInstance.id}/environment`);

                for (let i = 0; i < tasks.length; i++) {
                    const task = tasks[i];

                    logger.info({
                        msg: `Initiating task ${task.label}`,
                        task,
                        block: "start"
                    });

                    const env = {};
                    Object.assign(environment, env);

                    if (task.preBreakpoint) {
                        logger.info({ msg: `Tripping on Breakpoint`, breakpoint: true });
                        await TripBreakpoint(taskId);
                        logger.info({ msg: `Resuming from Breakpoint`, breakpoint: false });
                    }

                    const command = envSubstitute(task.command);
                    const args = task.arguments.map(a => envSubstitute(a));

                    const process = await new Promise<ChildProcessWithoutNullStreams>((res, rej) => {
                        logger.info({
                            msg: `Spawning process`,
                            command,
                            args,
                            task
                        });

                        const process = spawn(command, args, {
                            env: env,
                            cwd: task.workingDirectory,
                            timeout: task.commandTimeout || 0,
                            windowsHide: true
                        });

                        process.stdout.on('data', (data) => logger.socket.emit("log:stdout", { time: Date.now(), data }));
                        process.stderr.on('data', (data) => logger.socket.emit("log:stderr", { time: Date.now(), data }));

                        process.on('error', (err) => logger.error(err));

                        process.on('disconnect', (...args) => {
                            logger.error({
                                msg: `Process unexpectedly disconnected`,
                                args
                            });
                            res(process);
                        });

                        process.on('exit', (code) => {
                            if (code == 0) {
                                logger.info({ msg: `Process exited successfully` });
                                res(process);
                            }
                            else {
                                logger.error({ msg: `Process exited with non-zero exit code`, code });
                                res(process);
                            }
                        });
                    });

                    if (process.exitCode == 0) {
                        logger.info({
                            msg: `Completed task ${task.label}`,
                            process,
                            block: "end"
                        });
                        if (task.postBreakpoint) {
                            logger.info({ msg: `Tripping on Breakpoint`, breakpoint: true });
                            await TripBreakpoint(taskId);
                            logger.info({ msg: `Resuming from Breakpoint`, breakpoint: false });
                        }
                    }
                    else {
                        if (task.disableErrorBreakpoint != true) {
                            logger.info({ msg: `Breaking on error`, breakpoint: true, error: true });
                            await TripBreakpoint(taskId);
                            logger.info({ msg: `Resuming from Breakpoint`, breakpoint: true, error: false });
                        }
                    }
                }

                logger.info({
                    msg: `Completed TaskGroup ${taskGroup.label}`,
                    taskGroup,
                    block: "end"
                });
            }
            catch (ex) {
                logger.error({
                    msg: "Unhandled error",
                    stack: ex.stack,
                    error: ex.message,
                    name: ex.name
                });
            }

            await sleep(1);
            r(0);
        })));
    }

    // Perform preflight checks
    logger.info({ state: "Initializing", msg: "Begin initializing" });
    await api.patch(`/api/odata/${taskId}`, { state: "initializing" })
    await validateJobCanRun(job);
    logger.info({ state: "Initializing", msg: "Agent initialize completed" });

    // Download sources
    logger.info({ state: "Cloning", msg: "Agent source cloning", block: "start" });
    await api.patch(`/api/odata/${taskId}`, { state: "cloning" })
    await ResolveSources(pipeline, job);
    logger.info({ state: "Cloning", msg: "Agent source cloning completed", block: "end" });

    // Follow job steps to build code
    logger.info({ state: "Building", msg: "Agent building", block: "start" });
    await api.patch(`/api/odata/${taskId}`, { state: "building" })
    await RunTaskGroupsInParallel(job.taskGroups, kubeTask);
    logger.info({ state: "Building", msg: "Agent build completed", block: "end" });

    // Seal (compress) artifacts
    logger.info({ state: "Sealing", msg: "Agent sealing", block: "start" });
    await api.patch(`/api/odata/${taskId}`, { state: "sealing" })
    // TODO: compress and upload artifacts
    // (format? progress?)
    // await Promise.all(job.artifacts.map(async a => {
    //     a.source;
    //     await execa('')
    // }));
    logger.info({ state: "Sealing", msg: "Agent sealing completed", block: "end" });


    logger.info({ state: "finished", msg: "Agent has completed it's work.", block: "end" });
    await api.patch(`/api/odata/${taskId}`, { state: "finished", endTime: Date.now() });
}
