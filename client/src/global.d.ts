import { RootComponent } from 'src/app/root.component';
import { UserService } from 'src/app/services/user.service';


declare global {

    // Globally available on Window
    interface Window {
        root: RootComponent,
        user: UserService
    }
}
