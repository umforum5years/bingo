import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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
    { label: 'Конструктор', icon: 'pi pi-palette', routerLink: '/design' },
    { label: 'Игра', icon: 'pi pi-play', routerLink: '/play' }
  ]);
}
