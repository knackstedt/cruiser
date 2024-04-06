import { RootComponent } from 'client/app/root.component';
import { UserService } from 'client/app/services/user.service';


declare global {

    // Globally available on Window
    interface Window {
        root: RootComponent,
        user: UserService
    }
}
