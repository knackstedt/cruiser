import { isDevMode, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';
import { CommonModule, NgIf } from '@angular/common';
import { ServiceWorkerModule } from '@angular/service-worker';
import { ComponentResolveStrategy, NgxLazyLoaderModule } from '@dotglitch/ngx-lazy-loader';
import { ToastrModule } from 'ngx-toastr';

import { RootComponent } from './root.component';

import { Pages } from 'client/app/component.registry';
import { HTMLSanitizer } from 'client/app/pipes/urlsanitizer.pipe';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { NotFoundComponent } from 'client/app/components/@framework/not-found/not-found.component';
import { LazyProgressDistractorComponent } from 'client/app/components/@framework/lazy-progress-distractor/lazy-progress-distractor.component';
import { WindowErrorComponent } from 'client/app/components/@framework/error/error.component';
import { NavMenuComponent } from 'client/app/components/navmenu/menu.component';

@NgModule({
    declarations: [
        RootComponent
    ],
    imports: [
        NgIf,
        NavMenuComponent,
        MatDialogModule,
        NgxLazyLoaderModule.forRoot({
            // TODO: add additional registries
            entries: [
                ...Pages
            ],
            componentResolveStrategy: ComponentResolveStrategy.PickFirst,
            notFoundComponent: NotFoundComponent,
            loaderDistractorComponent: LazyProgressDistractorComponent,
            errorComponent: WindowErrorComponent
        }),
        ToastrModule.forRoot(),
        MatIconModule,
        BrowserModule,
        BrowserAnimationsModule,
        HttpClientModule,
        ServiceWorkerModule.register('ngsw-worker.js', {
          enabled: !isDevMode(),
          // Register the ServiceWorker as soon as the application is stable
          // or after 30 seconds (whichever comes first).
          registrationStrategy: 'registerWhenStable:30000'
        }),
    ],
    providers: [],
    bootstrap: [RootComponent]
})
export class AppModule { }
