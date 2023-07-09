import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/root.module';

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));
