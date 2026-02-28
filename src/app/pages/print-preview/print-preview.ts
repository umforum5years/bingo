import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import html2canvas from 'html2canvas';

interface BingoCell {
  name: string;
  number: number;
}

interface BingoCard {
  id: number;
  cells: BingoCell[];
  gridSize?: number;
  displayMode?: 'name' | 'number' | 'both';
}

type DisplayMode = 'name' | 'number' | 'both';

@Component({
  selector: 'app-print-preview',
  imports: [
    Button,
    Select,
    FormsModule
  ],
  templateUrl: './print-preview.html',
  styleUrl: './print-preview.css',
})
export class PrintPreview {
  protected readonly bingoCards = signal<BingoCard[]>([]);
  protected readonly displayMode = signal<DisplayMode>('both');
  protected readonly backgroundImage = signal<string | null>(null);
  protected readonly gridSize = signal<number>(5);
  protected readonly orientation = signal<'portrait' | 'landscape'>('portrait');

  protected readonly displayModes: { label: string; value: DisplayMode }[] = [
    { label: 'Название и номер', value: 'both' },
    { label: 'Только название', value: 'name' },
    { label: 'Только номер', value: 'number' },
  ];

  protected readonly orientations: { label: string; value: 'portrait' | 'landscape' }[] = [
    { label: 'Портретная (A4)', value: 'portrait' },
    { label: 'Альбомная (A4)', value: 'landscape' },
  ];

  protected loadBingoCards(): void {
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
              gridSize: item.gridSize || 5,
              displayMode: item.displayMode || 'both',
              cells: (item.numbers || []).map((num: number, i: number) => ({
                number: num,
                name: item.artists?.[i] || `Artist ${num}`,
              })),
            }));
            this.bingoCards.set(loadedCards);
            if (loadedCards.length > 0) {
              this.gridSize.set(loadedCards[0].gridSize || 5);
              this.displayMode.set(loadedCards[0].displayMode || 'both');
            }
          }
        } catch {
          console.error('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    }
  }

  protected selectBackgroundImage(): void {
    const fileInput = document.getElementById('backgroundImageInput') as HTMLInputElement;
    fileInput?.click();
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

  protected clearBackgroundImage(): void {
    this.backgroundImage.set(null);
  }

  protected printCards(): void {
    window.print();
  }

  protected async saveCardsAsPng(): Promise<void> {
    const cards = this.bingoCards();
    if (cards.length === 0) return;

    const contentContainer = document.querySelector('.print-preview-content');
    if (!contentContainer) return;

    const cardElements = contentContainer.querySelectorAll('.print-page');

    for (let i = 0; i < cardElements.length; i++) {
      const cardElement = cardElements[i];
      const card = cards[i];

      const canvas = await html2canvas(cardElement as HTMLElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const link = document.createElement('a');
      link.download = `bingo-card-${card.id}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      // Small delay between downloads to avoid browser blocking
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  protected getEffectiveGridSize(): number {
    const cards = this.bingoCards();
    if (cards.length > 0 && cards[0].gridSize) {
      return cards[0].gridSize;
    }
    return this.gridSize();
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
