CREATE pipeline:ulid() CONTENT {
	label: 'quaternion service',
    description: 'This is a test pipeline.',
    labelTemplate: '(arg) => \'foob\'',


    environment: [
        { key: "level1key", value: "level1value" },
        { key: "level1key2", value: "level1value2" }
    ]
};
CREATE pipeline:ulid() CONTENT {
	label: 'Inventory Service',
    description: 'This is a test pipeline.',
    labelTemplate: '(arg) => \'foob\'',
    sources: [
        {
            label: "git repo",
            targetPath: "/root/folder",
            username: "knackstedt",
            url: "https://github.com/knackstedt/dot-ops"
        }
    ]
};
CREATE pipeline:ulid() CONTENT {
	label: 'Fulfillment service',
    description: 'This is a test pipeline.',
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
CREATE pipeline:ulid() CONTENT {
	label: 'firefighter service',
    description: 'problems are solved with foam.',
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
CREATE pipeline:ulid() CONTENT {
	label: 'database service',
    description: 'This is a test pipeline.',
    labelTemplate: '(arg) => \'foob\'',


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
CREATE pipeline:ulid() CONTENT {
	label: 'server service',
    description: 'This is a test pipeline.',
    labelTemplate: '(arg) => \'foob\'',


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
CREATE pipeline:ulid() CONTENT {
	label: 'webserver service',
    description: 'This is a test pipeline.',
    labelTemplate: '(arg) => \'foob\'',


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
CREATE pipeline:ulid() CONTENT {
	label: 'queue service',
    description: 'This is a test pipeline.',
    labelTemplate: '(arg) => \'foob\'',


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
CREATE pipeline:ulid() CONTENT {
	label: 'enablement service',
    description: 'This is a test pipeline.',
    labelTemplate: '(arg) => \'foob\'',


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
CREATE pipeline:ulid() CONTENT {
	label: 'misc service',
    description: 'This is a test pipeline.',
    labelTemplate: '(arg) => \'foob\'',


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
CREATE pipeline:ulid() CONTENT {
	label: 'helper service',
    description: 'This is a test pipeline.',
    labelTemplate: '(arg) => \'foob\'',


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
CREATE pipeline:ulid() CONTENT {
	label: 'spear service',
    description: 'This is a test pipeline.',
    labelTemplate: '(arg) => \'foob\'',


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
CREATE pipeline:ulid() CONTENT {
	label: 'docker service',
    description: 'This is a test pipeline.',
    labelTemplate: '(arg) => \'foob\'',


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
CREATE pipeline:ulid() CONTENT {
	label: 'euclidian service',
    description: 'This is a test pipeline.',
    labelTemplate: '(arg) => \'foob\'',


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
CREATE pipeline:ulid() CONTENT {
	label: 'digitization service',
    description: 'This is a test pipeline.',
    labelTemplate: '(arg) => \'foob\'',


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
CREATE pipeline:ulid() CONTENT {
	label: 'json client',
    description: 'This is a test pipeline.',
    labelTemplate: '(arg) => \'foob\'',


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
CREATE pipeline:ulid() CONTENT {
	label: 'websocket service',
    description: 'This is a test pipeline.',
    labelTemplate: '(arg) => \'foob\'',


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
CREATE pipeline:ulid() CONTENT {
	label: 'websocket client',
    description: 'This is a test pipeline.',
    labelTemplate: '(arg) => \'foob\'',


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
CREATE pipeline:ulid() CONTENT {
	label: 'http3 service',
    description: 'This is a test pipeline.',
    labelTemplate: '(arg) => \'foob\'',


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
CREATE pipeline:ulid() CONTENT {
	label: 'http3 client',
    description: 'This is a test pipeline.',
    labelTemplate: '(arg) => \'foob\'',


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
CREATE pipeline:ulid() CONTENT {
	label: 'generic service',
    description: 'This is a test pipeline.',
    labelTemplate: '(arg) => \'foob\'',


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
CREATE pipeline:ulid() CONTENT {
	label: 'default service',
    description: 'This is a test pipeline.',
    labelTemplate: '(arg) => \'foob\'',


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
CREATE pipeline:ulid() CONTENT {
	label: 'petty service',
    description: 'This is a test pipeline.',
    labelTemplate: '(arg) => \'foob\'',


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
CREATE pipeline:ulid() CONTENT {
	label: 'progressive service',
    description: 'This is a test pipeline.',
    labelTemplate: '(arg) => \'foob\'',


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
CREATE pipeline:ulid() CONTENT {
	label: 'optimized service',
    description: 'This is a test pipeline.',
    labelTemplate: '(arg) => \'foob\'',


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
