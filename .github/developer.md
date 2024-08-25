# Development reference

This file will walk you through setting up an initial development environment -- enough to run locally and debug code with.

## Prerequisites

1. Kubernetes cluster. We recommend running k3s locally.
<!-- WIP: development without a kube instance -->
2. NodeJS 18+
3. SurrealDB 1.5+
4. VSCode
5. Basic understanding of CICD

> We do not recommend using minikube -- it is known to have issues. Run at your own risk.

## Running locally

First, head over to the `.env.example` file. You need to plug in values that match the different systems in your development environment.

1. Run `surreal start --user=root --pass=root` to start the database. You may alternatively use a hosted database instance.
2. Run the "Server" debug task from within VSCode. Alternatively you can directly start it via `npm run dev:server`.
<!-- (WIP) You can use a hosted backend service. -->
3. Run `npm run dev:web` to start the client's live reload server.
4. Open `https://localhost:6800` in a Chromium or Firefox browser. If you create an issue saying that it doesn't work with IE or Safari, I will close your issue.

### Example

```bash
$ npm run dev:web
> cruiser@0.0.208 dev:web
> cd client; ng serve --port 4600 --ssl --proxy-config ./proxy.config.json; cd ..

⠸ Building...
Initial chunk files | Names     |  Raw size
chunk-YK5CVPFP.js   | -         | 568.55 kB | 
styles.css          | styles    | 563.41 kB | 
polyfills.js        | polyfills |  83.60 kB | 
main.js             | main      |  40.52 kB | 
chunk-BLZJXFHA.js   | -         |   2.58 kB | 
chunk-YE2WK5TQ.js   | -         |   1.69 kB | 
chunk-UREVJ7RK.js   | -         |   1.58 kB | 
chunk-4WXVOEFY.js   | -         |   1.46 kB | 
```
