import { Component, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Table, TableModule } from 'primeng/table';

interface Artist {
  name: string;
  number: number | null;
}

interface BingoCard {
  id: number;
  cells: BingoCell[];
}

interface BingoCell {
  name: string;
  number: number;
}

type DisplayMode = 'name' | 'number' | 'both';

interface GridSize {
  label: string;
  value: number;
}

@Component({
  selector: 'app-design',
  imports: [
    Button,
    TableModule,
    InputText,
    IconField,
    InputIcon,
    InputNumber,
    Select,
    FormsModule
],
  templateUrl: './design.html',
  styleUrl: './design.css',
})
export class Design {
  @ViewChild('dt') dt!: Table;
  protected readonly artists = signal<Artist[]>([]);
  protected readonly selectedFiles = signal<File[]>([]);

  // Bingo card generation
  protected readonly gridSize = signal<number>(5);
  protected readonly customGridSize = signal<number | null>(null);
  protected readonly useCustomGrid = signal<boolean>(false);
  protected readonly displayMode = signal<DisplayMode>('both');
  protected readonly cardCount = signal<number>(1);
  protected readonly backgroundImage = signal<string | null>(null);
  protected readonly bingoCards = signal<BingoCard[]>([]);

  protected readonly gridSizes: GridSize[] = [
    { label: '5x5', value: 5 },
    { label: '6x6', value: 6 },
    { label: '7x7', value: 7 },
    { label: '8x8', value: 8 },
    { label: '9x9', value: 9 },
    { label: '10x10', value: 10 },
  ];

  protected readonly displayModes: { label: string; value: DisplayMode }[] = [
    { label: 'Название и номер', value: 'both' },
    { label: 'Только название', value: 'name' },
    { label: 'Только номер', value: 'number' },
  ];

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

  protected onBackgroundImageSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        this.backgroundImage.set(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  protected selectBackgroundImage(): void {
    const fileInput = document.getElementById('bgImageInput') as HTMLInputElement;
    fileInput?.click();
  }

  protected clearBackgroundImage(): void {
    this.backgroundImage.set(null);
    const fileInput = document.getElementById('bgImageInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  protected getEffectiveGridSize(): number {
    if (this.useCustomGrid() && this.customGridSize() && this.customGridSize()! >= 2) {
      return this.customGridSize()!;
    }
    return this.gridSize();
  }

  protected generateBingoCards(): void {
    const artists = this.artists().filter((a) => a.number !== null);
    const size = this.getEffectiveGridSize();
    const totalCells = size * size;
    const count = this.cardCount();

    if (artists.length < totalCells) {
      alert(
        `Недостаточно исполнителей для сетки ${size}x${size}. Требуется минимум ${totalCells}, доступно ${artists.length}`
      );
      return;
    }

    const maxPossibleCards = this.calculateMaxCombinations(artists.length, totalCells);
    if (count > maxPossibleCards) {
      alert(
        `Невозможно создать ${count} уникальных комбинаций. Максимально возможное количество для ${artists.length} исполнителей и сетки ${size}x${size}: ${maxPossibleCards}`
      );
      return;
    }

    const generatedCards: BingoCard[] = [];
    const usedCombinations = new Set<string>();

    for (let i = 0; i < count; i++) {
      let cardCells: Artist[];
      let combinationKey: string;
      let attempts = 0;
      const maxAttempts = 1000;

      do {
        const shuffled = this.shuffleArray([...artists]);
        cardCells = shuffled.slice(0, totalCells);
        combinationKey = cardCells
          .map((a) => a.number)
          .sort((a, b) => a! - b!)
          .join(',');
        attempts++;
      } while (usedCombinations.has(combinationKey) && attempts < maxAttempts);

      if (attempts >= maxAttempts) {
        alert(
          `Создано ${generatedCards.length} уникальных бланков. Не удалось создать больше уникальных комбинаций.`
        );
        break;
      }

      usedCombinations.add(combinationKey);

      const cells: BingoCell[] = cardCells.map((a) => ({
        name: a.name,
        number: a.number!,
      }));

      generatedCards.push({
        id: i + 1,
        cells,
      });
    }

    this.bingoCards.set(generatedCards);
  }

  private calculateMaxCombinations(n: number, k: number): number {
    if (k > n) return 0;
    if (k === 0 || k === n) return 1;
    if (k > n / 2) k = n - k;

    let result = 1;
    for (let i = 0; i < k; i++) {
      result = (result * (n - i)) / (i + 1);
    }
    return Math.floor(result);
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  protected clearBingoCards(): void {
    this.bingoCards.set([]);
  }

  protected saveBingoCardsJson(): void {
    const cards = this.bingoCards();
    const compactData = cards.map((card) => ({
      id: card.id,
      numbers: card.cells.map((c) => c.number),
      artists: card.cells.map((c) => c.name),
    }));
    const json = JSON.stringify(compactData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bingo-cards-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  protected loadBingoCardsJson(): void {
    const fileInput = document.getElementById('loadCardsFileInput') as HTMLInputElement;
    fileInput?.click();
  }

  protected onCardsFileLoad(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);
          if (Array.isArray(json)) {
            const loadedCards: BingoCard[] = json.map((item, index) => ({
              id: item.id ?? index + 1,
              cells: (item.numbers || []).map((num: number, i: number) => ({
                number: num,
                name: item.artists?.[i] || `Artist ${num}`,
              })),
            }));
            this.bingoCards.set(loadedCards);
          }
        } catch {
          console.error('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    }
  }

  protected getCellDisplay(cell: BingoCell): string {
    const mode = this.displayMode();
    switch (mode) {
      case 'name':
        return cell.name;
      case 'number':
        return cell.number.toString();
      case 'both':
      default:
        return `${cell.number}. ${cell.name}`;
    }
  }
}
