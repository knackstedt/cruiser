import { ComponentRegistration } from '@dotglitch/ngx-common';


export const Pages: ComponentRegistration[] = [
    { id: 'Login', load: () => import('./pages/login/login.component'), hidden: true },
    // { id: 'Dashboard', load: () => import('./pages/dashboard/dashboard.component'), icon: "dashboard" },

    { id: 'Pipelines', load: () => import('./pages/pipelines/pipelines.component'), icon: "line_axis" },
    // { id: 'Agents', load: () => import('./pages/agents/agents.component'), icon: "dns" },
    { id: 'Sources', load: () => import('./pages/sources/sources.component'), icon: "source" },

    { id: 'Users', load: () => import('./pages/users/users.component'), icon: "manage_accounts", isVisible: () => {
        return window.user.isManager;
    }},
    // { id: 'Configuration', load: () => import('client/app/pages/configuration/configuration.component'), icon: "settings" },
    // { id: 'Repos', load: () => import('client/app/pages/repos/repos.component'), icon: "https://git-scm.com/images/logos/downloads/Git-Icon-White.svg" },
    // { id: 'Analytics', load: () => import('client/app/pages/analytics/analytics.component'), icon: "analytics" },
];

