import { Injectable, signal } from '@angular/core';
import { SwUpdate, VersionReadyEvent, VersionInstallationFailedEvent } from '@angular/service-worker';
import { interval } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PwaUpdateService {
  private readonly updateAvailable = signal(false);
  private readonly updateInstalled = signal(false);

  readonly updateAvailable$ = this.updateAvailable.asReadonly();
  readonly updateInstalled$ = this.updateInstalled.asReadonly();

  constructor(private swUpdate: SwUpdate) {
    this.checkForUpdates();
  }

  private checkForUpdates(): void {
    // Проверяем доступность обновлений сразу при загрузке
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates.subscribe((event) => {
        switch (event.type) {
          case 'VERSION_DETECTED':
            console.log(`Downloading new app version: ${event.version.hash}`);
            break;
          case 'VERSION_READY':
            console.log('New app version ready.');
            this.updateAvailable.set(true);
            break;
          case 'VERSION_INSTALLATION_FAILED':
            const failedEvent = event as VersionInstallationFailedEvent;
            console.error(`Failed to install app version: ${failedEvent.error}`);
            break;
        }
      });

      // Проверяем обновления каждые 6 часов
      interval(6 * 60 * 60 * 1000).subscribe(() => {
        this.swUpdate.checkForUpdate();
      });
    }
  }

  async doUpdate(): Promise<boolean> {
    if (!this.swUpdate.isEnabled) {
      return false;
    }

    try {
      await this.swUpdate.activateUpdate();
      this.updateInstalled.set(true);
      return true;
    } catch (err) {
      console.error('Failed to update app', err);
      return false;
    }
  }

  async checkUpdate(): Promise<void> {
    if (this.swUpdate.isEnabled) {
      await this.swUpdate.checkForUpdate();
    }
  }
}
