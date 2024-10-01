import { exec } from 'child_process';
import os from 'os';
import fs from 'fs-extra';
import { ulid } from 'ulidx';

import { db } from '../db';
import { environment } from '../environment';
import { logger } from '../logger';
import { JobDefinition, PipelineDefinition, PipelineInstance, StageDefinition } from '../../types/pipeline';
import { JobInstance } from '../../types/agent-task';
import { AgentInitializer } from './interface';

export class LocalAgent implements AgentInitializer {
    async spawn(
        pipelineInstance: PipelineInstance,
        pipeline: PipelineDefinition,
        stage: StageDefinition,
        jobDefinition: JobDefinition,
        jobInstance: JobInstance,
        namespace: string,
        podName: string,
        podId: string,
        kubeAuthnToken: string,
        agentEnvironment: {
            name: string;
            value: string;
        }[]
    ) {
        const env = {};
        agentEnvironment.forEach(v => env[v.name] = v.value);

        // TODO: Replace with build dir
        const id = ulid();
        const buildDir = os.tmpdir() + '/cruiser_dev/' + id;

        await fs.emptyDir(buildDir);

        let log = '';
        // const proc = exec("ts-node -O '{\"target\": \"esnext\", \"module\": \"commonjs\"}' src/main.ts", {
        const proc = exec("node --nolazy -r ts-node/register src/main.ts", {
            cwd: "../agent",
            env: {
                ...process.env,
                ...env,
                CRUISER_AGENT_BUILD_DIR: buildDir
            },
            windowsHide: true
        });

        proc.stderr.addListener("data", data => log += data);
        proc.stdout.addListener("data", data => log += data);

        proc.on("exit", async code => {
            if (code) {
                const err = new Error("Agent process exited with non-zero code " + code);
                logger.error(err);
                console.error(err);
                await db.merge(jobInstance.id, { status: "failed" });
            }
            else {
                await db.merge(jobInstance.id, { status: "finished" });
            }

            const dir = [
                environment.cruiser_log_dir,
                pipeline.id,
                pipelineInstance.id,
                stage.id,
                jobDefinition.id
            ].join('/');

            await fs.mkdir(dir, { recursive: true });

            // Write the file to disk.
            await fs.writeFile(
                dir + '/' + jobInstance.id + ".log",
                log
            );
        });
        proc.on("disconnect", () => logger.error(new Error("Agent process disconnected!")));

        return id;
    }

    async watchRunningAgents() {
        // ???

        // Finalize any previously started instances.
        const pipelineInstances = await db.select<PipelineInstance>("pipeline_instance where status.phase != 'stopped'");
        for (const instance of pipelineInstances) {
            instance.status.phase = "stopped";
            await db.merge(instance.id, instance);
        }
        const jobInstances = await db.select<JobInstance>("job_instance where status != 'finished' OR state != 'finished'");
        for (const instance of jobInstances) {
            instance.state = "finished";
            // TODO: Investigate where this gets populated
            instance['status'] = "finished";
            await db.merge(instance.id, instance);
        }
    };
}
