# Agent

The Agent is the component that runs jobs. Each agent must have a solid HTTP and Websocket 
connection to the Cruiser Server.

#### State progression
Structure:
Pipeline
    Stage (build/quality/dev/stage/uat/preprod/prod)
        Job (An agent can run 1 job, jobs can run on multiple agents)
            Task group (executed in parrallel)
                Task   (executed sequentially)


1. Agent boots
2. Agent reads environment variables and connects to cluster
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


