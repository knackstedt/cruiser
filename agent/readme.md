
//

Structure:
Pipeline
    Stage (build/quality/dev/stage/uat/preprod/prod)
        Job (An agent can run 1 job, jobs can run on multiple agents)
            Task group (executed in parrallel)
                Task   (executed sequentially)


1. Agent boots
2. Agent reads arguments (JSON)
3. Agent downloads any sources, reports errors
4. Agent begins to execute commands as specified in job
    - Agent advertises "task ${calculatedName} starting"
    - If task.preBreakpoint flag set, halt here.
    - Agent runs task
    - If task.postBreakpoint flag set, halt here.
    - Agent advertises "task ${calculatedName} complete!"
    - Agent advertises "task ${calculatedName} failed!"
5. Agent uploads artifacts and dies
    - metadata:
        duration
        artifact size
        warning count
        error count
        info count?

When the agent is frozen:

Provide: 
1. filesystem access (read write zip)
2. terminal access
3. process list ?
4. environment variables ?

things we need to cache centrally
things downloaded from filesystem access -- can be marked to survive past default expiration time
    12h / 1d / 3d / 7d?

