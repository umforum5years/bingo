import { Component, inject } from '@angular/core';
import { Button } from 'primeng/button';
import { PwaUpdateService } from '../../services/pwa-update.service';

@Component({
  selector: 'app-pwa-update',
  imports: [Button],
  template: `
    @if (updateService.updateAvailable$()) {
      <div class="pwa-update-notification">
        <span>Доступна новая версия приложения</span>
        <p-button
          label="Обновить"
          icon="pi pi-refresh"
          size="small"
          (onClick)="applyUpdate()"
        />
      </div>
    }
  `,
  styles: [`
    .pwa-update-notification {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #1f2937;
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 0.5rem;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      gap: 1rem;
      z-index: 1000;
      animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `]
})
export class PwaUpdateComponent {
  protected readonly updateService = inject(PwaUpdateService);

  async applyUpdate(): Promise<void> {
    const updated = await this.updateService.doUpdate();
    if (updated) {
      window.location.reload();
    }
  }
}
