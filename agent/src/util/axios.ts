import { context, Span, SpanKind, trace } from '@opentelemetry/api';
import axios, { Axios, AxiosResponse } from 'axios';
import {environment} from './environment';

axios.defaults.baseURL = environment.cruiserUrl;
axios.defaults.headers.common['X-Cruiser-Token'] = environment.cruiserToken;
axios.defaults.headers.common['X-Cruiser-Agent'] = environment.jobInstanceId.split(':')[1];


const tracer = trace.getTracer('axios');

export const api = {
    get: ((parentSpan: Span, ...args) => {
        const ctx = trace.setSpan(context.active(), parentSpan);
        const span = tracer.startSpan("Axios:Get " + environment.cruiserUrl, undefined, ctx);
        span.setAttributes({
            "http.request.url": args[0],
            "http.method": "GET"
        });

        // @ts-ignore
        return axios.get(...args)
            .then(res => {
                span.setAttributes({
                    "http.response.body.length": 0
                });
                span.end();
                return res;
            })
            .catch(err => {
                span.end();
                throw err;
            })
    }) as <T>(span: Span, ...args: Parameters<Axios['get']>) => Promise<AxiosResponse<T, any>>,

    post: ((parentSpan: Span, ...args) => {
        const ctx = trace.setSpan(context.active(), parentSpan);
        const span = tracer.startSpan("Axios:Post " + environment.cruiserUrl, undefined, ctx);
        span.setAttributes({
            "http.request.url": args[0],
            "http.method": "POST"
        });

        // @ts-ignore
        return axios.post(...args)
            .then(res => {
                span.setAttributes({
                    "http.response.body.length": 0
                });
                span.end();
                return res;
            })
            .catch(err => {
                span.end();
                throw err;
            })
    }) as <T>(span: Span, ...args: Parameters<Axios['post']>) => Promise<AxiosResponse<T, any>>,

    patch: ((parentSpan: Span, ...args) => {
        const ctx = trace.setSpan(context.active(), parentSpan);
        const span = tracer.startSpan("Axios:Patch " + environment.cruiserUrl, undefined, ctx);
        span.setAttributes({
            "http.request.url": args[0],
            "http.method": "PATCH"
        });

        // @ts-ignore
        return axios.patch(...args)
            .then(res => {
                span.setAttributes({
                    "http.response.body.length": 0
                });
                span.end();
                return res;
            })
            .catch(err => {
                span.end();
                throw err;
            })
    }) as <T>(span: Span, ...args: Parameters<Axios['patch']>) => Promise<AxiosResponse<T, any>>
};
