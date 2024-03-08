import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss'],
    imports: [
        MatInputModule,
        MatButtonModule
    ],
    standalone: true
})
export class LoginComponent {

  constructor() { }

  ngOnInit() {
  }

}
