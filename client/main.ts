import { RootComponent } from './app/root.component';
import { isDevMode, importProvidersFrom } from '@angular/core';
import { ServiceWorkerModule } from '@angular/service-worker';
import { withInterceptorsFromDi, provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { ToastrModule } from 'ngx-toastr';
import { WindowErrorComponent } from './app/components/@framework/error/error.component';
import { LazyProgressDistractorComponent } from './app/components/@framework/lazy-progress-distractor/lazy-progress-distractor.component';
import { NotFoundComponent } from './app/components/@framework/not-found/not-found.component';
import { Pages } from './app/component.registry';
import { LazyLoaderModule, ComponentResolveStrategy } from '@dotglitch/ngx-common';
import { MatDialogModule } from '@angular/material/dialog';
import { NgIf } from '@angular/common';

bootstrapApplication(RootComponent, {
    providers: [
        importProvidersFrom(NgIf, MatDialogModule, LazyLoaderModule.forRoot({
            // TODO: add additional registries
            entries: [
                ...Pages
            ],
            componentResolveStrategy: ComponentResolveStrategy.PickFirst,
            notFoundComponent: NotFoundComponent,
            loaderDistractorComponent: LazyProgressDistractorComponent,
            errorComponent: WindowErrorComponent
        }), ToastrModule.forRoot(), MatIconModule, BrowserModule, ServiceWorkerModule.register('ngsw-worker.js', {
            enabled: !isDevMode(),
            // Register the ServiceWorker as soon as the application is stable
            // or after 30 seconds (whichever comes first).
            registrationStrategy: 'registerWhenStable:30000'
        })),
        provideAnimations(),
        provideHttpClient(withInterceptorsFromDi())
    ]
})
  .catch(err => console.error(err));
