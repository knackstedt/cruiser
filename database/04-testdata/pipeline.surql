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
            jobs: [
                {
                    label: "npm build",
                    runType: "1",
                    taskGroups: [
                        {
                            label: "group1",
                            environment: [
                                { key: "level4key", value: "level4value" },
                                { key: "level4key2", value: "level4value2" }
                            ]
                            tasks: [
                                {
                                    label: "test cmd",
                                    command: "echo",
                                    arguments: ["foo", "bar"],
                                    environment: [
                                        { key: "level5key", value: "level5value" },
                                        { key: "level5key2", value: "level5value2" }
                                    ]
                                },
                                {
                                    label: "test cmd",
                                    command: "ls",
                                    arguments: ["-aol"],
                                    environment: [
                                        { key: "level5bkey", value: "level5bvalue" },
                                        { key: "level5bkey2", value: "level5bvalue2" }
                                    ]
                                }
                            ]
                        }
                    ],
                    artifacts: [
                        {
                            label: "dist",
                            source: "/source/dir",
                            destination: "/remotefs/target"
                        }
                    ],
                    environment: [
                        { key: "level3key", value: "level3value" },
                        { key: "level3key2", value: "level3value2" }
                    ]
                }
            ]
        },
        {
            label: "deploy dev"
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

