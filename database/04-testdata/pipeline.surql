-- This is a painfully comprehensive data sample.

CREATE pipelineTask:ulid() CONTENT {
    label: "build-docker-test-prepare",
    environment: [{ key: "pipelineTask1B0", value: "mango" }, { key: "pipelineTask2B0", value: "waffle" }],
    command: "prepare.sh",
    arguments: ["version1"]
};
CREATE pipelineTask:ulid() CONTENT {
    label: "build-docker-test-build",
    environment: [{ key: "pipelineTask1N6", value: "mango" }, { key: "pipelineTask2N6", value: "waffle" }],
    command: "docker",
    arguments: ["build"]
};
CREATE pipelineTask:ulid() CONTENT {
    label: "build-docker-test-run",
    environment: [{ key: "pipelineTask1J7", value: "mango" }, { key: "pipelineTask2J7", value: "waffle" }],
    command: "docker",
    arguments: ["run --test"]
};

CREATE pipelineTask:ulid() CONTENT {
    label: "build-docker-build",
    environment: [{ key: "pipelineTask1E3", value: "mango" }, { key: "pipelineTask2E3", value: "waffle" }],
    command: "prepare.sh",
    arguments: ["version2"]
};
CREATE pipelineTask:ulid() CONTENT {
    label: "build-docker-build",
    environment: [{ key: "pipelineTask1W1", value: "mango" }, { key: "pipelineTask2W1", value: "waffle" }],
    command: "docker",
    arguments: ["build"]
};
CREATE pipelineTask:ulid() CONTENT {
    label: "build-docker-build",
    environment: [{ key: "pipelineTask1Q2", value: "mango" }, { key: "pipelineTask2Q2", value: "waffle" }],
    command: "docker",
    arguments: ["image push -t test/test"]
};

CREATE pipelineTask:ulid() CONTENT {
    label: "build-npm-test",
    environment: [{ key: "pipelineTask1J9", value: "mango" }, { key: "pipelineTask2J9", value: "waffle" }],
    command: "npm",
    arguments: ["test"]
};

CREATE pipelineTask:ulid() CONTENT {
    label: "build-npm-build",
    environment: [{ key: "pipelineTask1M2", value: "mango" }, { key: "pipelineTask2M2", value: "waffle" }],
    command: "npm",
    arguments: ["install"]
};
CREATE pipelineTask:ulid() CONTENT {
    label: "build-npm-build",
    environment: [{ key: "pipelineTask1L7", value: "mango" }, { key: "pipelineTask2L7", value: "waffle" }],
    command: "npm",
    arguments: ["run", "build"]
};

CREATE pipelineTask:ulid() CONTENT {
    label: "build-npm-lint",
    environment: [{ key: "pipelineTask1R3", value: "mango" }, { key: "pipelineTask2R3", value: "waffle" }],
    command: "eslint",
    arguments: ["-o", "config.json"]
};



CREATE pipelineTaskGroup:ulid() CONTENT {
    label: "build-docker-test",
    environment: [{ key: "pipelineTaskGroup1", value: "mango" }, { key: "pipelineTaskGroupVar2", value: "waffle" }],
    tasks: (SELECT id FROM pipelineTask WHERE string::startsWith(label, 'build-docker-test')).id
};
CREATE pipelineTaskGroup:ulid() CONTENT {
    label: "build-docker-build",
    environment: [{ key: "pipelineTaskGroup1", value: "mango" }, { key: "pipelineTaskGroupVar2", value: "waffle" }],
    tasks: (SELECT id FROM pipelineTask WHERE string::startsWith(label, 'build-docker-build')).id
};


CREATE pipelineTaskGroup:ulid() CONTENT {
    label: "build-npm-test",
    environment: [{ key: "pipelineTaskGroupA1", value: "mango" }, { key: "pipelineTaskGroupAVar2", value: "waffle" }],
    tasks: (SELECT id FROM pipelineTask WHERE string::startsWith(label, 'build-npm-test')).id
};
CREATE pipelineTaskGroup:ulid() CONTENT {
    label: "build-npm-build",
    environment: [{ key: "pipelineTaskGroupAA1", value: "mango" }, { key: "pipelineTaskGroupAVarA2", value: "waffle" }],
    tasks: (SELECT id FROM pipelineTask WHERE string::startsWith(label, 'build-npm-build')).id
};
CREATE pipelineTaskGroup:ulid() CONTENT {
    label: "build-npm-lint",
    environment: [{ key: "pipelineTaskGroupA1BZ", value: "mango" }, { key: "pipelineTaskGroupAVar2BZ", value: "waffle" }],
    tasks: (SELECT id FROM pipelineTask WHERE string::startsWith(label, 'build-npm-lint')).id
};


CREATE pipelineJob:ulid() CONTENT {
    label: "build-docker-test",
    environment: [{ key: "pipelineJob1", value: "mango" }, { key: "pipelineJob2", value: "waffle" }],
    taskGroups: (SELECT id FROM pipelineTaskGroup WHERE string::startsWith(label, 'build-docker-test')).id
};
CREATE pipelineJob:ulid() CONTENT {
    label: "build-docker-build",
    environment: [{ key: "pipelineJobA1K4", value: "mango" }, { key: "pipelineJobA2K4", value: "waffle" }],
    taskGroups: (SELECT id FROM pipelineTaskGroup WHERE string::startsWith(label, 'build-docker-build')).id
};


CREATE pipelineJob:ulid() CONTENT {
    label: "build-npm-test",
    environment: [{ key: "pipelineJobB1", value: "mango" }, { key: "pipelineJobB2", value: "waffle" }],
    taskGroups: (SELECT id FROM pipelineTaskGroup WHERE string::startsWith(label, 'build-npm-test')).id
};
CREATE pipelineJob:ulid() CONTENT {
    label: "build-npm-build",
    environment: [{ key: "pipelineJobC1", value: "mango" }, { key: "pipelineJobC2", value: "waffle" }],
    taskGroups: (SELECT id FROM pipelineTaskGroup WHERE string::startsWith(label, 'build-npm-build')).id
};
CREATE pipelineJob:ulid() CONTENT {
    label: "build-npm-lint",
    environment: [{ key: "pipelineJobD1", value: "mango" }, { key: "pipelineJobD2", value: "waffle" }],
    taskGroups: (SELECT id FROM pipelineTaskGroup WHERE string::startsWith(label, 'build-npm-lint')).id
};


CREATE pipelineStage:ulid() CONTENT {
    label: "build-docker",
    environment: [{ key: "pipelineStageProp1", value: "mango" }, { key: "pipelineStageProp2", value: "waffle" }],
    jobs: (SELECT id FROM pipelineJob WHERE string::startsWith(label, 'build-docker')).id
};
CREATE pipelineStage:ulid() CONTENT {
    label: "build-npm",
    environment: [{ key: "pipelineStagePropA1", value: "mango" }, { key: "pipelineStagePropA2", value: "waffle" }],
    jobs: (SELECT id FROM pipelineJob WHERE string::startsWith(label, 'build-npm')).id
};

-- CREATE pipelineStage:ulid() CONTENT {
--     label: "deploy dev",
--     environment: [
--         { key: "level2akey", value: "level2avalue" },
--         { key: "level2akey2", value: "level2avalue2" }
--     ],
--     jobs: [
--         {
--             label: "Deploy slot 1",
--             runType: "1",
--             taskGroups: [

--             ],
--             environment: [
--                 { key: "level3akey", value: "level3avalue" },
--                 { key: "level3akey2", value: "level3avalue2" }
--             ]
--         },
--         {
--             label: "Deploy slot 2",
--             runType: "1",
--             taskGroups: [

--             ],
--             environment: [
--                 { key: "level3ckey", value: "level3cvalue" },
--                 { key: "level3ckey2", value: "level3cvalue2" }
--             ]
--         }
--     ]
-- };

-- CREATE pipelineStage:ulid() CONTENT {
--     label: "deploy prod",
--     environment: [
--         { key: "level2akey", value: "level2avaluePROD" },
--         { key: "level2akey2", value: "level2avalue2PROD" }
--     ],
--     jobs: [
--         {
--             label: "Deploy prod slot 1",
--             runType: "1",
--             taskGroups: [

--             ],
--             environment: [
--                 { key: "level3akey", value: "level3avaluePROD" },
--                 { key: "level3akey2", value: "level3avalue2PROD" }
--             ]
--         },
--         {
--             label: "Deploy prod slot 2",
--             runType: "1",
--             taskGroups: [

--             ],
--             environment: [
--                 { key: "level3ckey", value: "level3cvaluePROD" },
--                 { key: "level3ckey2", value: "level3cvalue2PROD" }
--             ]
--         }
--     ]
-- };

CREATE pipeline:ulid() CONTENT {
	label: 'test-pipeline',
    description: 'This is a test pipeline.',
    labelTemplate: '(arg) => \'foob\'',

    stages: (SELECT id FROM pipelineStage WHERE string::startsWith(label, 'build')).id,
    -- (
    --     SELECT id FROM array::concat(
    --         (SELECT id FROM array::concat(
    --             (SELECT id FROM pipelineStage WHERE label = 'build' LIMIT 1),
    --             (SELECT id FROM pipelineStage WHERE label = 'deploy dev' LIMIT 1)
    --         )),
    --         (SELECT id FROM pipelineStage WHERE label = 'deploy prod' LIMIT 1)
    --     )
    -- ),
    environment: [
        { key: "pipelineVar1", value: "mango" },
        { key: "pipelineVar2", value: "waffle" }
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

