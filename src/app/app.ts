import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { Menubar } from 'primeng/menubar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Menubar],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('umforum-bingo');
  protected readonly menuItems = signal([
    { label: 'Design', icon: 'pi pi-palette', routerLink: '/design' },
    { label: 'Play', icon: 'pi pi-gamepad', routerLink: '/play' }
  ]);
}
