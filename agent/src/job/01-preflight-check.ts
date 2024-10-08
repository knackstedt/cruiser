import os from 'os';
import fs from 'fs-extra';
import { command } from 'execa';
import { context, Span, trace } from '@opentelemetry/api';

import { logger } from '../util/logger';
import { environment } from '../util/environment';

const tracer = trace.getTracer('agent-preflight');

// Assert we have the following programs!
const requiredDependencies = [
    {
        name: "git",
        message: "program git is required",
        alpine: "apk add git",
        corrections: {
            alpine: "apk add git",
            debian: "apt install git",
            ubuntu: "apt install git",
            // fedora: "",
            // rhel: ""
        }
    },
    {
        name: "lrzip",
        message: "program lrzip is required",
        corrections: {
            alpine: "apk add lrzip",
            debian: "apt install lrzip",
            ubuntu: "apt install lrzip",
            // fedora: "",
            // rhel: ""
        }
    },
    {
        name: "lrztar",
        message: "program lrztar is required",
        corrections: {
            alpine: "apk add lrzip-extra-scripts",
            debian: "apt install lrzip",
            ubuntu: "apt install lrzip",
            // fedora: "",
            // rhel: ""
        }
    }
]

/**
 * Perform a series of preflight checks to make sure
 * that the agent should be safe to run without exploding
 * unexpectedly. Will attempt to auto remediate system
 * dependencies on Linux based systems.
 */
export const PreflightCheck = async (
    parentSpan: Span
) => tracer.startActiveSpan(
    "PreflightCheck",
    undefined,
    trace.setSpan(context.active(), parentSpan),
    async span => {
    // Ensure the build directory exists
    await fs.mkdirp(environment.buildDir);

    const platform = os.platform();

    switch (platform) {
        case "linux": {
            const osRelease: {
                id: string,
                name: 'alpine' | 'ubuntu' | 'debian' | 'rhel' | 'fedora',
                version: string,
                version_id?: string,
                version_codename?: string,
                ubuntu_codename?: string
            } = {} as any;

            // Parse the os release file
            const data = await fs.readFile(`/etc/os-release`, 'utf8')
                .catch(err => {
                    logger.fatal({ msg: "Cannot identify linux distro" });
                    return '';
                });

            data
                .split('\n')
                .forEach(line => {
                    let [key, value] = line.split('=');

                    if (value?.startsWith('"'))
                        value = value.slice(1, -1);

                    osRelease[key?.toLowerCase()] = value;
                })

            // Attempt to resolve all of the missing dependencies.
            for (const dependency of requiredDependencies) {
                const isInstalled = await command(`which ` + dependency.name)
                    .then(r => !!r.stdout)
                    .catch(r => false);

                // If the program is already installed, continue.
                if (isInstalled) continue;

                // If the program doesn't exist, attempt to install it.
                const correction = dependency.corrections[osRelease.id];

                logger.warn({
                    msg: `Attempting to automatically install missing dependency \`${dependency.name}\`.\n` +
                    `    To improve build times, add this dependency to your base image.`
                });

                // Run the corrective action.
                // Will fail if the user doesn't have access to
                // install things through the package manager
                const resolved = await command(correction)
                    .then(r => !!r.stdout)
                    .catch(r => false);

                if (!resolved) {
                    logger.fatal({
                        msg: "Failed to automatically install required dependency",
                        properties: {
                            dependency: dependency.name,
                            correction
                        }
                    })
                }
            }
            break;
        }
        case "win32": {
            // Windows will have defaults.
            break;
        }
        default: {
            // We don't know if this would work
            logger.fatal({
                msg: "This agent isn't running a tested operating system. There will be no guarantees or support for things that go horribly wrong. You have been warned."
            })
        }
    }

    span.end();
});

