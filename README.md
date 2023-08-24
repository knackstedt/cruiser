# Dot Ops

.Ops -- a modern and robust CI/CD toolchain for tomorrow's applications.

## Motivation

It'd be sweet to have a CI/CD platform that doesn't require constant jerry-rigging to work
the way you need it to, and can reduce the amount of time spent trying to connect your CI/CD
system with your git repositories and your devops tracking systems. Something that **just works**
without needing to spend hundreds of hours reconfiguring and updating.

Enter Dot Ops, a robust approach to CI/CD, with enterprise-grade
security and extensibility. With support for elastic agents and an interface made
for real humans, it's the next best thing in DevSecOps!

> #### ⚠️ ALPHA STATE

The project is currently in its very early alpha stages. We are in the process of
solidifying the base of the framework and stabilizing the architecture.


## Roadmap
 - [ ] Create "freeze" points and allow remote terminal connections through web UI
 - [ ] Create base worker image and sample k8s setup
 - [ ] Pipeline job execution labels can be defined from simple JS scripts
 - [ ] Executed jobs have links to git history up to that job
 - [ ] Known build tools (docker, gulp, msbuild) should have a tailored experience
 - [ ] Pipeline failure hooks
 - [ ] Add env variables:
   - [ ] "global system"
   - [ ] "project"
   - [ ] "pipeline"
   - [ ] "stage"
   - [ ] "job"
   - [ ] "task group"
   - [ ] "task"
 - [ ] Add release management graphical screen
     - [ ] Branch filters
     - [ ] Add "Triggers"
     - [ ] Add "Approvers"
     - [ ] Add CRON triggers
     - [ ] Auto-trigger and approve next release if previous release has been deployed and not redacted
     - [ ] Manage release secrets
 - [ ] Static build agent support
 - [ ] Add support for pipeline templates
 - [ ] Add stage webhook support
 - [ ] Add support for non-git based code repos
 - [ ] Record error messages over time and provide "smart" analysis
 - [ ] Support for plugin system
 - [ ] Support for hosting git repos
 - [ ] Support for load testing quality gate metric integration
 - [ ] Destroy all humans


