import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { exists, mkdir } from 'fs-extra';
import environment from './environment';

import { TaskDefinition } from '../../types/pipeline';
import { getSocketLogger } from '../socket/logger';
import { JobInstance } from '../../types/agent-task';
import { TripBreakpoint } from '../socket/breakpoint';
import { ParseCommand } from './command-parser';

export const RunProcess = async (
    jobInstance: JobInstance,
    task: TaskDefinition,
    logger: Awaited<ReturnType<typeof getSocketLogger>>
) => {
    let retry = false;
    do {
        retry = false;


        if (task.preBreakpoint) {
            logger.info({ msg: `Tripping on Breakpoint`, breakpoint: true });
            await TripBreakpoint(jobInstance, false);
            logger.info({ msg: `Resuming from Breakpoint`, breakpoint: false });
        }

        // Try to create the CWD.
        if (!await exists(task.workingDirectory || environment.buildDir))
            await mkdir(task.workingDirectory || environment.buildDir, { recursive: true });

        const process: ChildProcessWithoutNullStreams = await new Promise<ChildProcessWithoutNullStreams>((res, rej) => {
            try {
                // TODO: join env separately.
                // const specifiedCommand = task.taskScriptArguments['command'];
                const {
                    command,
                    args,
                    env
                } = ParseCommand(task.taskScriptArguments['command'] + ' ' + task.taskScriptArguments['arguments']);

                logger.info({
                    msg: `Spawning process`,
                    command: command,
                    args,
                    task
                });

                const process = spawn(command, args, {
                    env: env,
                    cwd: task.workingDirectory || environment.buildDir,
                    timeout: task.commandTimeout || 0,
                    windowsHide: true
                });

                process.stdout.on('data', (data) => logger.stdout({ time: Date.now(), data }));
                process.stderr.on('data', (data) => logger.stderr({ time: Date.now(), data }));

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
            }
            catch(err) {
                // Return the process and transmit the error object
                res({
                    exitCode: -1,
                    err: err
                } as any);
            }
        });

        if (process?.exitCode == 0) {
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
            logger.error({
                msg: process.exitCode == -1 ? "Failed to spawn process" : "Process exited with code " + process.exitCode,
                ...(process.exitCode == -1 ? { err: process['err'] } : { process })
            });
            if (task.disableErrorBreakpoint != true) {
                logger.info({ msg: `Breaking on error`, breakpoint: true, error: true });
                await TripBreakpoint(jobInstance);
                logger.info({ msg: `Resuming from Breakpoint`, breakpoint: true, error: false });
            }
        }
    }
    while(retry)
}
