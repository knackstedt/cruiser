# ⚠️ Archived

**This repository is archived and not actively maintained.**

## What was Cruiser?

Cruiser was a CI/CD platform built around a novel idea: **breakpoints for pipelines**. Instead of only reading logs after the fact, you could pause a running workflow mid-step, inspect state, and step through execution like a debugger — rather than the usual guess-and-push-and-wait loop of iterating on CI configs.

## Why it's archived

Two reasons:

- **Complexity.** Supporting real breakpoint/step semantics across arbitrary CI workflows turned out to require a lot of moving parts (execution graph processing, step isolation, step retrying and skipping, resumable runners) for a platform that also had to do all the normal things a CI system does. That complexity never fully paid for itself.
- **The core problem got smaller.** The main value of Cruiser was cutting down the pain of debugging CI runs. With AI-assisted development, it's now much easier to reason about a failing workflow, spot the issue, and fix it without needing a live debugger attached to the pipeline. The gap Cruiser was built to fill has largely closed on its own.

Combined with lack of adoption, it didn't make sense to keep developing or supporting it.

## Status

- No further commits, releases, or issue triage.
- Feel free to fork if any of the ideas here are useful to you.
- Not recommended for production use.

---

# Cruiser: The Modern Kubernetes-Native CI/CD Platform

Cruiser is a powerful and intuitive Continuous Integration/Continuous Deployment (CI/CD) platform designed for the modern cloud-native ecosystem. It runs natively on Kubernetes and provides a rich set of features to streamline your development and delivery workflows, from code to production.

-----

## Key Features

### 🚀 **Kubernetes-Native & Scalable**

Cruiser is built from the ground up to run on Kubernetes, leveraging its native scaling and orchestration capabilities. This ensures high availability, fault tolerance, and efficient resource utilization, allowing your pipelines to scale effortlessly with your needs.

### 💻 **Integrated Debugging & IDE-like Experience**

Tired of debugging pipeline failures with logs alone? Cruiser brings the power of an Integrated Development Environment (IDE) to your CI/CD pipelines. You can interact directly with your running tasks, inspect variables, and step through your code, making troubleshooting faster and more efficient than ever before.

### ⏸️ **Task Breakpoints & Resume Functionality**

Gain granular control over your pipeline execution. Set **breakpoints** on specific tasks to pause a run, allowing you to examine the state of your environment before proceeding. Once you've diagnosed an issue or made a change, you can **resume** the pipeline from the exact point it was paused.

### ⚙️ **Intuitive UI & Parallel Execution**

Cruiser's user-friendly interface provides a clear and comprehensive view of your pipelines. Visualize your entire workflow and monitor its status in real-time. The platform also supports **parallel task execution**, allowing you to run multiple independent tasks concurrently to drastically reduce pipeline run times.

### 📊 **Live Pipeline Statuses**

Stay informed with real-time updates. The Cruiser UI offers a live dashboard showing the status of your pipelines and individual tasks. Instantly see which tasks are running, which have succeeded, and which have failed, giving you immediate feedback on your deployment health.

<!-- ----- -->

<!-- ## Getting Started -->



<!-- 1.  **Prerequisites:** Ensure you have a running Kubernetes cluster and `kubectl` configured.
2.  **Installation:** Install Cruiser using the Helm chart.
    ```bash
    helm repo add cruiser https://charts.cruiser.io
    helm install cruiser cruiser/cruiser
    ```
3.  **Access the UI:** After installation, forward the UI port to your local machine.
    ```bash
    kubectl port-forward svc/cruiser-ui 8080:80
    ```
    Then, navigate to `http://localhost:8080` in your browser.

For more detailed information, please refer to our [official documentation](https://www.google.com/search?q=https://docs.cruiser.io). -->

-----

## Contributing

We welcome contributions\! Please see our [contributing guide](https://github.com/knackstedt/cruiser/blob/main/CONTRIBUTING.md) for more details on how to get involved.

-----

## License

This project is licensed under the MIT License.


## Roadmap
- [X] Pipeline, stage, job failure hooks
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
- [ ] Add CRON triggers
- [ ] Add "nightly" additional that's fixed on system time
- [ ] Pipeline instance labels can be defined from simple JS scripts
- [ ] Support Pipeline definition as code file (YAML, JSON)
- [ ] Projects that can group pipelines and teams / boards
- [ ] Env vars & secrets on "global system"
- [ ] Env vars & secrets on "project"
- [ ] Auto-trigger and approve next release if previous release has been deployed and not redacted
- [ ] Detect OOM crashes from known languages / build tools
- [ ] Add support for pipeline templates
- [ ] Add support for non-git based code repos
- [ ] Create base worker images and sample k8s setup
- [ ] Record error messages over time and provide "smart" analysis
- [ ] Known build tools (docker, gulp, msbuild etc) should have a tailored experience
- [ ] Support for setting "Deployment freeze" periods
- [ ] Support for "rollback to latest stable build" API
- [ ] Support for watching deployment progress
- [ ] Support for plugin system
- [ ] Support for hosting git repos
- [ ] Support user metrics for hosted repos
- [ ] Support Artillery load testing + metrics (builtin?)
- [ ] Support for common load testing & quality gate metric integration
- [ ] Documentation -- need help!
- [ ] Agent configure graph: disabled tasks become opaque
- [ ] Agent configure graph: task conditions (if not met make the dependants all a shade of red/pink?)
- [ ] On startup run preflight system checks
- [ ] System alerts -- failed pipelines, system state + health
- [ ] Allow rollback of failed / partial deployments / tasks
- [ ] Simulate task execution (clarify: how?)
- [ ] Branch based templating and filters 
- [ ] Advanced task filter syntax (use JS?)
- [ ] Kanban tracking board
- [ ] metrics export => how long do builds take, how long does each stage/job/task take
- [ ] metrics export => how many builds were manual, automated, scheduled
- [ ] Fetch secrets from a key vault
- [ ] Plugins (ui, agent, backend)
- [ ] AI auto build stages and pipelines
- [ ] Drop in jenkins replacement or conversion tool
- [ ] Create Kube CRDs that define everything about the server + build agents
- [ ] Create Kube CRDs that define build and release pipelines
- [ ] Static build agent support
- [ ] Destroy all humans


