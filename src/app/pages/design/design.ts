import { Component, signal, ViewChild } from '@angular/core';
import { Button } from 'primeng/button';
import { TableModule, Table } from 'primeng/table';
import { InputText } from 'primeng/inputtext';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';

interface Artist {
  name: string;
  number: number | null;
}

@Component({
  selector: 'app-design',
  imports: [Button, TableModule, InputText, IconField, InputIcon],
  templateUrl: './design.html',
  styleUrl: './design.css',
})
export class Design {
  @ViewChild('dt') dt!: Table;
  protected readonly artists = signal<Artist[]>([]);
  protected readonly selectedFiles = signal<File[]>([]);

  protected filterGlobal(event: Event, filterValue: string): void {
    const input = event.target as HTMLInputElement;
    this.dt.filterGlobal(input.value, filterValue);
  }

  protected onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const files = Array.from(input.files).filter((f) =>
        f.name.toLowerCase().endsWith('.mp3')
      );
      this.selectedFiles.set(files);
      this.extractArtists();
    }
  }

  protected selectTracks(): void {
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    fileInput?.click();
  }

  protected extractArtists(): void {
    const files = this.selectedFiles();
    const artistSet = new Set<string>();

    files.forEach((file) => {
      const fileName = file.name.replace(/\.mp3$/i, '');
      const parts = fileName.split('-');
      if (parts.length >= 2) {
        const artist = parts[0].trim();
        if (artist) {
          artistSet.add(artist);
        }
      }
    });

    this.artists.set(
      Array.from(artistSet).map((name) => ({ name, number: null }))
    );
  }

  protected assignNumbers(): void {
    const artistsList = this.artists();
    const numbers = Array.from(
      { length: artistsList.length },
      (_, i) => i + 1
    );

    // Fisher-Yates shuffle
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }

    this.artists.set(
      artistsList.map((artist, index) => ({
        name: artist.name,
        number: numbers[index],
      }))
    );
  }

  protected saveArtists(): void {
    const artists = this.artists();
    const json = JSON.stringify(artists, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'artists.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  protected loadArtists(): void {
    const fileInput = document.getElementById('loadFileInput') as HTMLInputElement;
    fileInput?.click();
  }

  protected onFileLoad(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);
          if (Array.isArray(json)) {
            this.artists.set(json);
          }
        } catch {
          console.error('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    }
  }
}
