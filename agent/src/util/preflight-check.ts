import { logger } from './logger';
import os from 'os';
import fs from 'fs-extra';
import { command } from 'execa';

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
export const PreflightCheck = async () => {
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
                    logger.fatal("Cannot identify linux distro");
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
                    .then(r => true)
                    .catch(r => false);

                // If the program is already installed, continue.
                if (isInstalled) continue;

                // If the program doesn't exist, attempt to install it.
                const correction = dependency.corrections[osRelease.id];

                // Run the corrective action.
                // Will fail if the user doesn't have access to
                // install things through the package manager
                const resolved = await command(correction)
                    .then(r => true)
                    .catch(r => false);

                if (!resolved) {
                    logger.fatal({
                        msg: "Failed to automatically install required dependency",
                        dependency: dependency.name,
                        correction
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
}
