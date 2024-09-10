import { ComponentRegistration } from '@dotglitch/ngx-common';


export const Pages: ComponentRegistration[] = [
    { id: 'Login', load: () => import('./pages/login/login.component'), hidden: true },
    // { matcher: /^$|Dashboard|landing/, load: () => import('./pages/dashboard/dashboard.component'), icon: "dashboard", label: "Dashboard", id: "Dashboard" },

    // {
    //     id: 'Pipelines',
    //     load: () => import('./pages/pipelines/pipelines.component'),
    //     icon: "line_axis"
    // },
    // {
    //     matcher: /Pipelines\/(?<pipeline_id>[^/]+)/i,
    //     load: () => import('./pages/pipelines/editor/editor.component'),
    //     hidden: true
    // },
    {
        hidden: true,
        matcher: /Pipelines\/(?<pipeline_id>[^/]+)/i,
        load: () => import('./pages/releases/release-editor/release-editor.component')
    },
    {
        id: 'Pipelines',
        matcher: /^$|Dashboard|landing|pipelines/,
        label: "Pipelines",
        load: () => import('./pages/releases/releases.component'),
        icon: "new_releases"
    },

    // { id: 'Agents', load: () => import('./pages/agents/agents.component'), icon: "dns" },
    { id: 'Sources', load: () => import('./pages/sources/sources.component'), icon: "source" },

    { id: 'Users', load: () => import('./pages/users/users.component'), icon: "manage_accounts", isVisible: () => {
        return window.user.isManager;
    }},
    { id: 'System/Settings', load: () => import('src/app/pages/system-configuration/system-configuration.component'), icon: "settings" },
    // { id: 'Repos', load: () => import('src/app/pages/repos/repos.component'), icon: "https://git-scm.com/images/logos/downloads/Git-Icon-White.svg" },
    // { id: 'Analytics', load: () => import('src/app/pages/analytics/analytics.component'), icon: "analytics" },
];

