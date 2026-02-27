import { Component, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { Button } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { Card } from 'primeng/card';
import { Tooltip } from 'primeng/tooltip';

interface Artist {
  name: string;
  number: number;
}

type DisplayMode = 'name' | 'number' | 'both';

interface BingoCard {
  id: number;
  gridSize?: number;
  displayMode?: DisplayMode;
  numbers: number[];
  artists: string[];
}

interface MatchedCard {
  card: BingoCard;
  matchedCount: number;
  matchedNumbers: number[];
  matchPercentage: number;
  completedRows: number;
  completedCols: number;
}

@Component({
  selector: 'app-play',
  imports: [
    Button,
    InputNumber,
    Card,
    FormsModule,
    DecimalPipe,
    Tooltip
  ],
  templateUrl: './play.html',
  styleUrl: './play.css',
})
export class Play {
  protected readonly artists = signal<Artist[]>([]);
  protected readonly bingoCards = signal<BingoCard[]>([]);
  protected readonly drawnNumbers = signal<number[]>([]);
  protected readonly manualNumber = signal<number | null>(null);

  protected readonly matchedCards = computed<MatchedCard[]>(() => {
    const cards = this.bingoCards();
    const drawn = this.drawnNumbers();

    if (drawn.length === 0) return [];

    return cards
      .map((card) => {
        const matchedNumbers = card.numbers.filter((n) => drawn.includes(n));
        const matchPercentage = (matchedNumbers.length / card.numbers.length) * 100;
        const gridSize = card.gridSize || 5;

        // Подсчёт заполненных строк
        let completedRows = 0;
        for (let row = 0; row < gridSize; row++) {
          const rowStart = row * gridSize;
          const rowNumbers = card.numbers.slice(rowStart, rowStart + gridSize);
          const allMatched = rowNumbers.every((n) => drawn.includes(n));
          if (allMatched) completedRows++;
        }

        // Подсчёт заполненных столбцов
        let completedCols = 0;
        for (let col = 0; col < gridSize; col++) {
          const colNumbers: number[] = [];
          for (let row = 0; row < gridSize; row++) {
            colNumbers.push(card.numbers[row * gridSize + col]);
          }
          const allMatched = colNumbers.every((n) => drawn.includes(n));
          if (allMatched) completedCols++;
        }

        return {
          card,
          matchedCount: matchedNumbers.length,
          matchedNumbers,
          matchPercentage,
          completedRows,
          completedCols,
        };
      })
      .filter((mc) => mc.matchedCount > 0)
      .sort((a, b) => b.matchPercentage - a.matchPercentage);
  });

  protected readonly totalNumbers = computed(() => this.artists().length);
  protected readonly lastDrawnNumber = computed(() => {
    const drawn = this.drawnNumbers();
    return drawn.length > 0 ? drawn[drawn.length - 1] : null;
  });

  protected loadArtists(): void {
    const fileInput = document.getElementById('loadArtistsFileInput') as HTMLInputElement;
    fileInput?.click();
  }

  protected onArtistsFileLoad(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);
          if (Array.isArray(json)) {
            this.artists.set(json);
            this.drawnNumbers.set([]);
          }
        } catch {
          console.error('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    }
  }

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
            this.bingoCards.set(json);
          }
        } catch {
          console.error('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    }
  }

  protected drawRandomNumber(): void {
    const artists = this.artists();
    const drawn = this.drawnNumbers();
    
    if (artists.length === 0) {
      alert('Сначала загрузите список исполнителей');
      return;
    }
    
    if (drawn.length >= artists.length) {
      alert('Все номера уже выпали');
      return;
    }
    
    const availableNumbers = artists
      .map((a) => a.number)
      .filter((n) => !drawn.includes(n));
    
    const randomIndex = Math.floor(Math.random() * availableNumbers.length);
    const drawnNumber = availableNumbers[randomIndex];
    
    this.drawnNumbers.update((nums) => [...nums, drawnNumber]);
  }

  protected drawManualNumber(): void {
    const number = this.manualNumber();
    const artists = this.artists();
    const drawn = this.drawnNumbers();

    if (number === null) return;

    const artistExists = artists.some((a) => a.number === number);
    if (!artistExists) {
      alert(`Номер ${number} не найден в списке исполнителей`);
      return;
    }

    if (drawn.includes(number)) {
      alert(`Номер ${number} уже выпал`);
      return;
    }

    this.drawnNumbers.update((nums) => [...nums, number]);
    this.manualNumber.set(null);
  }

  protected removeDrawnNumber(number: number): void {
    const confirmed = confirm(`Удалить номер ${number} из выпавших? Он снова станет доступным для розыгрыша.`);
    if (confirmed) {
      this.drawnNumbers.update((nums) => nums.filter((n) => n !== number));
    }
  }

  protected resetGame(): void {
    this.drawnNumbers.set([]);
  }

  protected getArtistByNumber(number: number): string {
    const artist = this.artists().find((a) => a.number === number);
    return artist ? artist.name : '';
  }
}
