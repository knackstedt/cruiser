# Cruiser
Revolutionizing CICD with Kubernetes.

## Motivation

It'd be sweet to have a CI/CD platform that doesn't require constant jerry-rigging to work
the way you need it to. Your automation tools should **just work**,

Enter Cruiser, a robust approach to CI/CD, with enterprise-grade
security and extensibility. With native Kubernetes support and an interface made
for humans, it's the next best thing in DevSecOps!

> #### ⚠️ ALPHA STATE

The project is currently in its early alpha stages. We are in the process of
solidifying the base of the framework and stabilizing the architecture. There will be bugs, 
and you have been warned :)


## Roadmap
> Ordered by priority.
- [ ] Branch filters
- [ ] Add CRON triggers
- [ ] Pipeline instance labels can be defined from simple JS scripts
- [ ] Support Pipeline definition as code file (YAML,JSON)
- [ ] Pipeline, stage, job failure hooks
- [ ] Projects that can group pipelines and teams / boards
- [ ] Env vars & secrets on "global system"
- [ ] Env vars & secrets on "project"
- [ ] Auto-trigger and approve next release if previous release has been deployed and not redacted
- [ ] Add support for pipeline templates
- [ ] Add support for non-git based code repos
- [ ] Create base worker images and sample k8s setup
- [ ] Record error messages over time and provide "smart" analysis
- [ ] Document installation and use
- [ ] Known build tools (docker, gulp, msbuild) should have a tailored experience
- [ ] Support for setting "Deployment freeze" periods
- [ ] Support for "rollback to latest stable build" API
- [ ] Support for watching deployment progress
- [ ] Support for plugin system
- [ ] Support for hosting git repos
- [ ] Support user metrics for hosted repos
- [ ] Support Artillery load testing + metrics (builtin?)
- [ ] Support for common load testing & quality gate metric integration
- [ ] Agent configure graph: disabled tasks become opaque
- [ ] Agent configure graph: task conditions (if not met make the dependants all a shade of red/pink?)
- [ ] On startup run preflight checks (create alert center)
- [ ] Allow rollback of failed / partial deployments / tasks
- [ ] Simulate task execution (clarify: how?)
- [ ] Branch based templating and filters builtin
- [ ] Advanced task filter syntax (use JS?)
- [ ] Kanban tracking board
- [ ] Static build agent support
- [ ] Destroy all humans
- [X] Add stage "Triggers"
- [X] Add stage "Approvers"
- [X] Add stage webhook support
- [X] Env vars & secrets on "pipeline"
- [X] Env vars & secrets on "stage"
- [X] Env vars & secrets on "job"
- [X] Env vars & secrets on "task group"
- [X] Env vars & secrets on "task"
- [X] Enable disabling pipelines, jobs, stages, task groups etc.
- [X] Create breakpoints and allow remote terminal connections through web UI



