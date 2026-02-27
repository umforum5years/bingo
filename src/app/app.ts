import { Component, signal, computed } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Menubar } from 'primeng/menubar';
import { PwaUpdateComponent } from './components/pwa-update/pwa-update.component';
import { MenuItem } from 'primeng/api';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Menubar, PwaUpdateComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('umforum-bingo');
  protected readonly isDarkTheme = signal<boolean>(false);
  
  protected readonly menuItems = computed<MenuItem[]>(() => [
    { label: 'Конструктор', icon: 'pi pi-palette', routerLink: '/design' },
    { label: 'Игра', icon: 'pi pi-play', routerLink: '/play' },
    {
      icon: this.isDarkTheme() ? 'pi pi-sun' : 'pi pi-moon',
      command: () => this.toggleTheme(),
      ariaLabel: this.isDarkTheme() ? 'Включить светлую тему' : 'Включить темную тему'
    }
  ]);

  protected toggleTheme(): void {
    this.isDarkTheme.update(value => !value);
    document.documentElement.classList.toggle('dark-theme', this.isDarkTheme());
  }
}
