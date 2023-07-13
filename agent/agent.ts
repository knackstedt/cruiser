import { Observable } from 'rxjs';
import crypto from 'crypto';
import { getLogger, sleep } from './util';
import Surreal from 'surrealdb.js';
import { execa } from 'execa';
import { AgentJob } from '../types/agent-task';
import { PipelineTaskGroup } from '../types/pipeline';

const logger = getLogger("agent");

const db = new Surreal('http://127.0.0.1:8000/rpc');
await db.signin({
    user: 'root',
    pass: 'root',
});
await db.use({ ns: '@dotglitch', db: 'dotops' });


async function freezeProcessing({taskGroup, agentTask, taskId} : {taskGroup: PipelineTaskGroup, agentTask: AgentJob, taskId: string}) {
    logger.info("Encountered freeze marker in task group", taskGroup)
    await db.merge(taskId, { state: "frozen" });
    while (true) {
        await sleep(5000);

        agentTask = await db.select(taskId) as any;
        if (agentTask.state == "resume") {
            await db.merge(taskId, { state: "building" });
            break;
        }
    }
    return agentTask;
}

(async () => {
    const agentId = process.env['AGENT_ID'];
    const taskId = `jobInstance:` + agentId;

    let agentTask: AgentJob = await db.select(taskId) as any;

    logger.info({ msg: "Agent initialized." });
    await db.merge(taskId, { state: "initializing" });


    await db.merge(taskId, { state: "cloning" });
    await db.merge(taskId, { state: "building" });

    const taskGroups = agentTask.job.taskGroups;

    await Promise.all(taskGroups.map(async taskGroup => {



        const tasks = taskGroup.tasks;

        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];


            task

            const env = {

                ...task.environment
            };





            if (task.freezeBeforeRun)
                await freezeProcessing({taskGroup, agentTask, taskId});


            await execa(task.command, task.arguments, {
                env,
                cwd: task.workingDirectory,
                timeout: task.commandTimeout || 0
            });


            if (task.freezeAfterRun)
                await freezeProcessing({taskGroup, agentTask, taskId});

        }


        return sleep(1);
    }))

    await db.merge(taskId, { state: "sealing" });

    await db.merge(taskId, { state: "finished" });

})();
