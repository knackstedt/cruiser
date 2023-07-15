CREATE pipeline:ulid() CONTENT {
	label: 'test-pipeline',
    description: 'This is a test pipeline.',
    labelTemplate: '(arg) => \'foob\'',

    stages: [
        {
            label: "build",
            environment: [
                { key: "level2key", value: "level2value" },
                { key: "level2key2", value: "level2value2" }
            ],
        },
        {
            label: "deploy dev",
            environment: [
                { key: "level2akey", value: "level2avalue" },
                { key: "level2akey2", value: "level2avalue2" }
            ],
            jobs: [
                {
                    label: "Deploy slot 1",
                    runType: "1",
                    taskGroups: [

                    ],
                    environment: [
                        { key: "level3akey", value: "level3avalue" },
                        { key: "level3akey2", value: "level3avalue2" }
                    ]
                },
                {
                    label: "Deploy slot 2",
                    runType: "1",
                    taskGroups: [

                    ],
                    environment: [
                        { key: "level3ckey", value: "level3cvalue" },
                        { key: "level3ckey2", value: "level3cvalue2" }
                    ]
                }
            ]
        }
    ],
    environment: [
        { key: "level1key", value: "level1value" },
        { key: "level1key2", value: "level1value2" }
    ],
    sources: [
        {
            label: "git repo",
            targetPath: "/root/folder",
            username: "knackstedt",
            url: "https://github.com/knackstedt/dot-ops"
        },
        {
            label: "lib repo",
            targetPath: "/root/lib",
            username: "knackstedt",
            url: "https://github.com/knackstedt/ngx-ctx-menu"
        }
    ]
};

