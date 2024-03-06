import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { exists, mkdir } from 'fs-extra';
import { Logger } from 'pino';

import { sleep } from './util/sleep';
import { orderSort } from './util/order-sort';
import { envSubstitute } from './util/envsubst';
import environment from './util/environment';
import { TripBreakpoint } from './util/breakpoint';
import { JobDefinition, PipelineDefinition, TaskGroupDefinition } from '../types/pipeline';
import { api } from './util/axios';
import { getSocketLogger } from './socket/logger';

export const RunTaskGroupsInParallel = (taskGroups: TaskGroupDefinition[], jobInstance, logger: Awaited<ReturnType<typeof getSocketLogger>>) => {
    taskGroups?.sort(orderSort);

    return Promise.all(taskGroups.map(taskGroup => new Promise(async (r) => {
        try {
            logger.info({
                msg: `Initiating TaskGroup ${taskGroup.label}`,
                taskGroup,
                block: "start"
            });

            const tasks = taskGroup.tasks.sort(orderSort);

            const envVars: { key: string, value: string; }[] =
                await api.get(`/api/jobs/${jobInstance.id}/environment`);

            for (let i = 0; i < tasks.length; i++) {
                const task = tasks[i];

                logger.info({
                    msg: `Initiating task ${task.label}`,
                    task,
                    block: "start"
                });

                const env = {};
                Object.assign(envVars, env);

                if (task.preBreakpoint) {
                    logger.info({ msg: `Tripping on Breakpoint`, breakpoint: true });
                    await TripBreakpoint(jobInstance);
                    logger.info({ msg: `Resuming from Breakpoint`, breakpoint: false });
                }

                const command = envSubstitute(task.command);
                const args = task.arguments.map(a => envSubstitute(a));

                // Create the cwd if it's missing
                if (!await exists(task.workingDirectory || environment.buildDir))
                    await mkdir(task.workingDirectory || environment.buildDir, { recursive: true });

                const process = await new Promise<ChildProcessWithoutNullStreams>((res, rej) => {
                    logger.info({
                        msg: `Spawning process`,
                        command,
                        args,
                        task
                    });

                    const process = spawn(command, args, {
                        env: env,
                        cwd: task.workingDirectory || environment.buildDir,
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
                        await TripBreakpoint(jobInstance);
                        logger.info({ msg: `Resuming from Breakpoint`, breakpoint: false });
                    }
                }
                else {
                    if (task.disableErrorBreakpoint != true) {
                        logger.info({ msg: `Breaking on error`, breakpoint: true, error: true });
                        await TripBreakpoint(jobInstance);
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
};
