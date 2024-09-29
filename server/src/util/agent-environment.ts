import { JobInstance } from '../types/agent-task';
import { JobDefinition, PipelineDefinition, PipelineInstance, StageDefinition } from '../types/pipeline';
import { environment } from './environment';

export const getAgentEnvironment = (
    pipelineInstance: PipelineInstance,
    pipeline: PipelineDefinition,
    stage: StageDefinition,
    jobDefinition: JobDefinition,
    jobInstance: JobInstance,
    namespace: string,
    podName: string,
    podId: string,
    kubeAuthnToken: string
) => {
    // TODO: Add a compendium of standard environment variables?
    // https://docs.gitlab.com/ee/ci/variables/predefined_variables.html
    // https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-env-vars.html
    // https://developer.harness.io/docs/continuous-integration/troubleshoot-ci/ci-env-var/
    // https://docs.acquia.com/acquia-cloud-platform/features/pipelines/variables
    // https://docs.gocd.org/current/faq/dev_use_current_revision_in_build.html
    // https://learn.microsoft.com/en-us/azure/devops/pipelines/build/variables?view=azure-devops&tabs=yaml
    // https://devopsqa.wordpress.com/2019/11/19/list-of-available-jenkins-environment-variables/
    // https://docs.travis-ci.com/user/environment-variables/
    // https://www.jetbrains.com/help/teamcity/predefined-build-parameters.html#Build+Branch+Parameters
    const agentEnvironment = [
        { name: "CI", value: "true" },
        // { name: "CI_COMMIT_AUTHOR", value: "true" },
        // { name: "CI_COMMIT_BEFORE_SHA", value: "true" },
        // { name: "CI_COMMIT_BRANCH", value: "true" },
        // { name: "CI_COMMIT_DESCRIPTION", value: "true" },
        // { name: "CI_COMMIT_MESSAGE", value: "true" },
        // { name: "CI_COMMIT_REF_NAME", value: "true" },
        // { name: "CI_COMMIT_REF_PROTECTED", value: "true" },
        // { name: "CI_COMMIT_REF_SLUG", value: "true" },
        // { name: "CI_COMMIT_SHA", value: "true" },
        // { name: "CI_COMMIT_SHORT_SHA", value: "true" },
        // { name: "CI_COMMIT_TAG", value: "true" },
        // { name: "CI_COMMIT_TAG_MESSAGE", value: "true" },
        // { name: "CI_COMMIT_TIMESTAMP", value: "true" },
        // { name: "CI_COMMIT_TITLE", value: "true" },
        { name: "CI_ENVIRONMENT", value: "cruiser" },
        // TODO: calculate this value by introspecting the server
        // hostname -i => ip address
        { name: "CRUISER_CLUSTER_URL", value: environment.cruiser_cluster_url },
        { name: "CRUISER_AGENT_ID", value: jobInstance.id.split(':')[1] },
        { name: "CRUISER_SERVER_TOKEN", value: kubeAuthnToken },

        // Provide the otel configuration that the server has
        { name: "OTEL_EXPORTER_OTLP_ENDPOINT", value: process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] },

        ...(jobDefinition.environment ?? []),
        ...(stage.environment ?? []),
        ...(pipeline.environment ?? [])
    ].filter(e => !!e.name.trim());

    return agentEnvironment;
}
