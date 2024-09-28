// import { ChildProcessWithoutNullStreams, exec, spawn } from 'child_process';
// import { exists, mkdir, mkdirp } from 'fs-extra';
// import { context, Span, trace } from '@opentelemetry/api';
// import {environment} from './environment';

// import { JobDefinition, PipelineDefinition, PipelineInstance, StageDefinition, TaskDefinition, TaskGroupDefinition } from '../types/pipeline';
// import { CreateLoggerSocketServer } from '../socket/logger';
// import { JobInstance } from '../types/agent-task';
// import { TripBreakpoint } from '../socket/breakpoint';
// import { ParseCommand } from './command-parser';
// import { api } from './axios';
// import { ulid } from 'ulidx';

// const tracer = trace.getTracer('agent-task');

// export const RunProcess = async (
//     parentSpan: Span,
//     pipelineInstance: PipelineInstance,
//     pipeline: PipelineDefinition,
//     stage: StageDefinition,
//     job: JobDefinition,
//     taskGroup: TaskGroupDefinition,
//     task: TaskDefinition,
//     jobInstance: JobInstance,
//     logger: Awaited<ReturnType<typeof CreateLoggerSocketServer>>,
//     gid: number,
//     tgid: string
// ) => {
//     const correlationId = ulid();

//     let retry = false;
//     let breakOnNextTask = false;
//     do {
//         retry = false;

//         const ctx = trace.setSpan(context.active(), parentSpan);
//         await tracer.startActiveSpan("Task", undefined, ctx, async span => {
//             const processCWD = task.cwd?.startsWith("/")
//                 ? task.cwd
//                 : environment.buildDir + (task.cwd ?? '');

//             span.setAttributes({
//                 "taskGroup.id": taskGroup.id,
//                 "task.id": task.id,
//                 "task.cwd": processCWD
//             });

//             if (breakOnNextTask) {
//                 logger.info({ msg: `BEFORE TASK`, properties: { taskGroup, task, gid, tgid, correlationId } });
//                 breakOnNextTask = (await TripBreakpoint(span, jobInstance, false, taskGroup, task)) == 2;
//                 logger.info({ msg: `Resuming from Breakpoint`, properties: { taskGroup, task, gid, tgid } });
//             }
//             if (task.breakBeforeTask) {
//                 logger.info({ msg: `⏸ Tripping on PreExecute Breakpoint`, properties: { taskGroup, task, gid, tgid, correlationId } });
//                 await TripBreakpoint(span, jobInstance, false, taskGroup, task, correlationId);
//                 logger.info({ msg: `Resuming from Breakpoint`, properties: { taskGroup, task, gid, tgid } });
//             }

//             // Try to create the CWD.
//             await mkdirp(processCWD);

//             const process: ChildProcessWithoutNullStreams =
//                 await new Promise<ChildProcessWithoutNullStreams>(async(res, rej) => {
//                 try {
//                     // TODO: join env separately.
//                     // const specifiedCommand = task.taskScriptArguments['command'];

//                     const {
//                         command,
//                         args,
//                         env
//                     } = ParseCommand(task.taskScriptArguments['command'] + ' ' + task.taskScriptArguments['arguments']);

//                     const execEnv = {};

//                     Object.entries(global.process.env)
//                         // Omit variables that we don't want the underlying program to
//                         // have to deal with
//                         .filter(e => !e[0].startsWith("CI_"))
//                         .filter(e => !e[0].startsWith("CRUISER_"))
//                         .filter(e => !e[0].startsWith("KUBERNETES_"))
//                         .forEach(e => execEnv[e[0]] = e[1]);

//                     // TODO: Parse variables out of command? Will we decide against this?
//                     // Object.entries(env)

//                     const roots = [ pipeline, stage, job, taskGroup, task ];

//                     const secretRequests: Promise<{key: string, value: string}>[] = [];

//                     // Collect all of the environment variables defined on each level
//                     for (let i = 0; i < roots.length; i++) {
//                         const envList = roots[i].environment ?? [];

//                         for (let j = 0; j < envList.length; j++) {
//                             const envItem = envList[j] ?? {} as any;

//                             // If the variable is a secret, we'll request that.
//                             if (envItem.isSecret) {
//                                 secretRequests.push(api.get(span, `/api/${roots[i].id}/${envItem.value}`)
//                                     .then(res => ({ key: envItem.name, value: res.data } as any))
//                                     .catch(err => {
//                                         logger.error({
//                                             msg: `Failed to load secret \`${envItem.key}\``,
//                                             properties: {
//                                                 stack: err.stack,
//                                                 message: err.message,
//                                                 gid, tgid
//                                             }
//                                         });
//                                         return { key: envItem.name, value: null, err };
//                                     }));

//                                 continue;
//                             }
//                             else {
//                                 execEnv[envItem.name] = envItem.value;
//                             }
//                         }
//                     }

//                     // Resolve all of the secret requests. This allows
//                     // them to be fetched in parallel.
//                     for await (const secret of secretRequests) {
//                         execEnv[secret.key] = secret.value;
//                     }

//                     logger.info({
//                         msg: `Spawning process \`${command}\` for task \`${task.label}\` in group \`${taskGroup.label}\``,
//                         properties: { processCWD, command, args, execEnv, taskGroup, task, gid, tgid }
//                     });

//                     const ctx = trace.setSpan(context.active(), span);
//                     await tracer.startActiveSpan("Process", undefined, ctx, async span => {
//                         span.setAttributes({
//                             "process.command": command,
//                             "process.arguments": args,
//                             "process.timeout": task.timeout || 0
//                         });
//                         const process = spawn(command, args, {
//                             env: execEnv,
//                             cwd: processCWD,
//                             timeout: task.timeout || 0,
//                             windowsHide: true
//                         });

//                         process.stdout.on('data', (data) => logger.stdout({ time: Date.now(), level: "stdout", chunk: data, properties: { task: task.id, gid, tgid } }));
//                         process.stderr.on('data', (data) => logger.stderr({ time: Date.now(), level: "stderr", chunk: data, properties: { task: task.id, gid, tgid } }));

//                         process.on('error', (err) => {
//                             span.setAttributes({ "process.exitCode": -2 });
//                             logger.error({
//                                 msg: "Process error",
//                                 properties: {
//                                     stack: err.stack,
//                                     message: err.message,
//                                     gid, tgid
//                                 }
//                             });
//                             // Do I need to set exit code?
//                             res(process);
//                         });

//                         process.on('disconnect', (...args) => {
//                             span.setAttributes({ "process.exitCode": -1 });
//                             logger.error({
//                                 msg: `Process \`${command}\` unexpectedly disconnected`,
//                                 properties: { args, taskGroup, task, gid, tgid }
//                             });
//                             res(process);
//                         });

//                         process.on('exit', (exitCode) => {
//                             span.setAttributes({ "process.exitCode": exitCode });
//                             if (exitCode == 0) {
//                                 logger.info({ msg: `Process \`${command}\` exited successfully`, properties: { taskGroup, task, gid, tgid } });
//                                 span.end();
//                                 res(process);
//                             }
//                             else {
//                                 logger.error({ msg: `Process \`${command}\` exited with non-zero exit code \`${exitCode}\``, properties: { code: exitCode, taskGroup, task, gid, tgid } });
//                                 span.end();
//                                 res(process);
//                             }
//                         });
//                     })
//                 }
//                 catch(err) {
//                     // Return the process and transmit the error object
//                     res({
//                         exitCode: -1,
//                         err: err
//                     } as any);
//                 }
//             });

//             if (process?.exitCode == 0) {
//                 logger.info({
//                     msg: `Completed task \`${task.label}\` in group \`${taskGroup.label}\``,
//                     properties: { process, taskGroup, task, gid, tgid },
//                     block: "end"
//                 });

//                 if (task.breakOnTaskSuccess) {
//                     logger.info({ msg: `⏸ Tripping on Success Breakpoint`, properties: { taskGroup, task, gid, tgid, correlationId } });
//                     const breakpointResult = await TripBreakpoint(span, jobInstance, true, taskGroup, task, correlationId);
//                     retry = breakpointResult == 1;
//                     breakOnNextTask = breakpointResult == 2;
//                     logger.info({ msg: `▶ Resuming from Breakpoint`, properties: { taskGroup, task, gid, tgid } });
//                 }
//             }
//             // TODO: Should this property be carried up to the pipeline?
//             else if (task.breakOnTaskFailure) {
//                 logger.info({ msg: `⏸ Breaking on error`, properties: { taskGroup, task, gid, tgid, correlationId } });
//                 const breakpointResult = await TripBreakpoint(span, jobInstance, true, taskGroup, task, correlationId);
//                 retry = breakpointResult == 1;
//                 breakOnNextTask = breakpointResult == 2;
//                 logger.info({ msg: `▶ Resuming from Breakpoint`, properties: { taskGroup, task, gid, tgid } });
//             }

//             if (task.breakAfterTask) {
//                 logger.info({ msg: `⏸ Tripping on PostExecute Breakpoint`, properties: { taskGroup, task, gid, tgid, correlationId } });
//                 const breakpointResult = await TripBreakpoint(span, jobInstance, true, taskGroup, task, correlationId);
//                 retry = breakpointResult == 1;
//                 breakOnNextTask = breakpointResult == 2;
//                 logger.info({ msg: `▶ Resuming from Breakpoint`, properties: { taskGroup, task, gid, tgid } });
//             }

//             span.end();
//         });
//     }
//     while(retry)
// }
