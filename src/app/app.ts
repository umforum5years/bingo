import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Menubar } from 'primeng/menubar';
import { PwaUpdateComponent } from './components/pwa-update/pwa-update.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Menubar, PwaUpdateComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('umforum-bingo');
  protected readonly menuItems = signal([
    { label: 'Конструктор', icon: 'pi pi-palette', routerLink: '/design' },
    { label: 'Игра', icon: 'pi pi-play', routerLink: '/play' }
  ]);
}
