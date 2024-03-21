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

        let process: ChildProcessWithoutNullStreams;
        try {
            process = await new Promise<ChildProcessWithoutNullStreams>((res, rej) => {
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
                }
                catch(err) {
                    rej(err);
                }
            });
        }
        catch(err) {
            logger.error(err);
        }

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
            if (task.disableErrorBreakpoint != true) {
                logger.info({ msg: `Breaking on error`, breakpoint: true, error: true });
                await TripBreakpoint(jobInstance);
                logger.info({ msg: `Resuming from Breakpoint`, breakpoint: true, error: false });
            }
        }
    }
    while(retry)
}
