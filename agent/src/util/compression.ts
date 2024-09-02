import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { CreateLoggerSocketServer } from '../socket/logger';
import { environment } from './environment';
import { mkdirp } from 'fs-extra';

const runCommand = (
    command: string,
    args: string[],
    metadata,
    logger,
) => {
    return new Promise<ChildProcessWithoutNullStreams>(async (res, rej) => {
        const process = spawn(command, args, {
            cwd: environment.buildDir,
            windowsHide: true
        });

        let stdout = '';
        let stderr = '';
        process.stdout.on('data', (data) => (stdout += data) && logger.stdout({ time: Date.now(), data, scope: "sealing" }));
        process.stderr.on('data', (data) => (stderr += data) && logger.stderr({ time: Date.now(), data, scope: "sealing" }));

        process.on('error', (err) => {
            logger.error({
                msg: "Process error",
                err
            })
        });

        process.on('disconnect', (...args) => {
            logger.error({
                msg: `Process unexpectedly disconnected`,
                args
            });
            res({
                ...process,
                exitCode: -1
            } as any);
        });

        process.on('exit', (code) => {
            // If the process exits with 0 and DOESN'T print this error.
            if (code == 0 && !stderr.includes("dist: No such file or directory")) {
                logger.info({ msg: `Process exited successfully` });
                res({
                    ...metadata,
                    ...process,
                    stdout,
                    stderr
                } as any);
            }
            else {
                logger.error({ msg: `Process exited with non-zero exit code`, code });
                res({
                    ...metadata,
                    ...process,
                    exitCode: process.exitCode == 0 ? -1 : process.exitCode,
                    stdout,
                    stderr
                } as any);
            }
        });
    });
};

export const compressTarLrz = (
    dir: string,
    targetFile: string,
    logger: Awaited<ReturnType<typeof CreateLoggerSocketServer>>
) => {
    const path = targetFile + '.tar.lrz';

    // lrztar -z -o test.tar.lrz ./dotglitch-ngx/
    return runCommand(
        'lrztar',
        ['-z', '-o', path, dir],
        { path, dir, algorithm: "lrzip" },
        logger
    );
};

export const compressTarGZip = (
    dir: string,
    targetFile: string,
    logger: Awaited<ReturnType<typeof CreateLoggerSocketServer>>
) => {
    const path = targetFile + '.tar.gz';

    // tar -zcvf test.tar.gz ./dotglitch-ngx/
    return runCommand(
        'tar',
        ['-zcvf', path, dir],
        { path, dir, algorithm: "gzip" },
        logger
    );
};

export const decompressTarLrz = async (
    archiveFile: string,
    outputPath: string,
    logger: Awaited<ReturnType<typeof CreateLoggerSocketServer>>
) => {
    await mkdirp(outputPath);

    // lrztar -d ./test.tar.lrz
    return runCommand(
        'lrztar',
        ['-d', archiveFile, '-C', outputPath],
        { archiveFile, outputPath, algorithm: "lrzip" },
        logger
    );
};

export const decompressTarGZip = async (
    archiveFile: string,
    outputPath: string,
    logger: Awaited<ReturnType<typeof CreateLoggerSocketServer>>
) => {
    await mkdirp(outputPath);

    // tar -xf ./test.tar.gz
    return runCommand(
        'tar',
        ['-xf', archiveFile, '-C', outputPath],
        { archiveFile, outputPath, algorithm: "gzip" },
        logger
    );
};
