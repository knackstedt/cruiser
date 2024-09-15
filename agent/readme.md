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

Structure
Pipeline > Stages > Jobs > Task Groups > Tasks

# Pipeline
One pipeline acts as the root for your context

# Stages
A pipeline can have N number of stages, they will run in parallel unless you
specify "precedingStages", which will make that stage wait before running.

# Jobs
When a stage runs, all jobs are queued simultaneously.

# Task Groups
When a jobs runs, task groups are run in parallel unless "preTaskGroups" is specified.
If `preTaskGroups` is specified, the task group will only run AFTER the specified groups have
finished running

# Tasks 
Tasks are run in order (1-by-1) when a task group begins executing. 
The order in which they are executed is based on the `order` value of the task, not their
position in the tasks array.



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


# OpenTelemetry
