import { ComponentRegistration } from '@dotglitch/ngx-lazy-loader';


export const Pages: ComponentRegistration[] = [
    { id: 'Login', load: () => import('client/app/pages/login/login.component'), hidden: true },
    // { id: 'Dashboard', load: () => import('client/app/pages/dashboard/dashboard.component'), icon: "dashboard" },

    { id: 'Pipelines', load: () => import('client/app/pages/pipelines/pipelines.component'), icon: "line_axis" },
    { id: 'Agents', load: () => import('client/app/pages/agents/agents.component'), icon: "dns" },
    // { id: 'Configuration', load: () => import('client/app/pages/configuration/configuration.component'), icon: "settings" },
    // { id: 'Repos', load: () => import('client/app/pages/repos/repos.component'), icon: "https://git-scm.com/images/logos/downloads/Git-Icon-White.svg" },
    // { id: 'Analytics', load: () => import('client/app/pages/analytics/analytics.component'), icon: "analytics" },
];

