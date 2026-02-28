import { Component, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { Button } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { Card } from 'primeng/card';
import { Tooltip } from 'primeng/tooltip';
import { SelectButton } from 'primeng/selectbutton';
import { FireworksComponent } from '../../components/fireworks/fireworks.component';

interface Artist {
  name: string;
  number: number;
}

type DisplayMode = 'name' | 'number' | 'both';

type MatchedSortType = 'matchedCount' | 'completedTotal';

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
  completedDiagonals: number;
  completedTotal: number;
}

interface MatchedCardWithCompletion extends MatchedCard {
  hasNewCompletion: boolean;
}

@Component({
  selector: 'app-play',
  imports: [
    Button,
    InputNumber,
    Card,
    FormsModule,
    DecimalPipe,
    Tooltip,
    SelectButton,
    FireworksComponent
  ],
  templateUrl: './play.html',
  styleUrl: './play.css',
})
export class Play {
  protected readonly artists = signal<Artist[]>([]);
  protected readonly bingoCards = signal<BingoCard[]>([]);
  protected readonly drawnNumbers = signal<number[]>([]);
  protected readonly manualNumber = signal<number | null>(null);
  protected readonly showFireworks = signal<boolean>(false);
  protected readonly hadFullMatch = signal<Set<number>>(new Set());
  protected readonly matchedSortType = signal<MatchedSortType>('matchedCount');
  protected readonly previousCompletedTotals = signal<Map<number, number>>(new Map());

  protected readonly sortOptions = [
    { label: 'По количеству совпадений', value: 'matchedCount' },
    { label: 'По заполненным линиям', value: 'completedTotal' },
  ];

  protected readonly matchedCardsBase = computed<MatchedCard[]>(() => {
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

        // Подсчёт заполненных диагоналей
        let completedDiagonals = 0;

        // Главная диагональ (слева-сверху вправо-вниз)
        const mainDiagonalNumbers: number[] = [];
        for (let i = 0; i < gridSize; i++) {
          mainDiagonalNumbers.push(card.numbers[i * gridSize + i]);
        }
        if (mainDiagonalNumbers.every((n) => drawn.includes(n))) {
          completedDiagonals++;
        }

        // Побочная диагональ (справа-сверху влево-вниз)
        const antiDiagonalNumbers: number[] = [];
        for (let i = 0; i < gridSize; i++) {
          antiDiagonalNumbers.push(card.numbers[i * gridSize + (gridSize - 1 - i)]);
        }
        if (antiDiagonalNumbers.every((n) => drawn.includes(n))) {
          completedDiagonals++;
        }

        const completedTotal = completedRows + completedCols + completedDiagonals;

        return {
          card,
          matchedCount: matchedNumbers.length,
          matchedNumbers,
          matchPercentage,
          completedRows,
          completedCols,
          completedDiagonals,
          completedTotal,
        };
      })
      .filter((mc) => mc.matchedCount > 0)
      .sort((a, b) => {
        const sortType = this.matchedSortType();
        if (sortType === 'matchedCount') {
          return b.matchedCount - a.matchedCount;
        } else {
          const aTotal = a.completedRows + a.completedCols + a.completedDiagonals;
          const bTotal = b.completedRows + b.completedCols + b.completedDiagonals;
          // Сначала сортируем по заполненным линиям
          if (bTotal !== aTotal) {
            return bTotal - aTotal;
          }
          // Если линии равны, сортируем по количеству совпадений
          return b.matchedCount - a.matchedCount;
        }
      });
  });

  protected readonly matchedCards = computed<MatchedCardWithCompletion[]>(() => {
    const baseCards = this.matchedCardsBase();
    const previousTotals = this.previousCompletedTotals();

    return baseCards.map((mc) => {
      const previousTotal = previousTotals.get(mc.card.id) || 0;
      const hasNewCompletion = mc.completedTotal > previousTotal && mc.completedTotal > 0;
      return {
        ...mc,
        hasNewCompletion,
      };
    });
  });

  protected readonly newCompletionsCount = computed(() => {
    return this.matchedCards().filter(mc => mc.hasNewCompletion).length;
  });

  protected readonly totalNumbers = computed(() => this.artists().length);
  protected readonly lastDrawnNumber = computed(() => {
    const drawn = this.drawnNumbers();
    return drawn.length > 0 ? drawn[drawn.length - 1] : null;
  });

  constructor() {
    effect(() => {
      const matched = this.matchedCards();
      const fullMatchCards = matched.filter(mc => mc.matchPercentage === 100);

      for (const card of fullMatchCards) {
        if (!this.hadFullMatch().has(card.card.id)) {
          console.log('Full match detected for card:', card.card.id);
          this.hadFullMatch.update(set => {
            const newSet = new Set(set);
            newSet.add(card.card.id);
            return newSet;
          });
          this.triggerFireworks();
        }
      }
    }, { allowSignalWrites: true });
  }

  private triggerFireworks(): void {
    this.showFireworks.set(true);
  }

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
            this.hadFullMatch.set(new Set());
            this.showFireworks.set(false);
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
            this.hadFullMatch.set(new Set());
            this.showFireworks.set(false);
            this.previousCompletedTotals.set(new Map());
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

    // Сохраняем текущие значения перед добавлением нового номера
    const currentTotals = new Map<number, number>();
    this.matchedCardsBase().forEach((mc) => {
      currentTotals.set(mc.card.id, mc.completedTotal);
    });
    this.previousCompletedTotals.set(currentTotals);

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

    // Сохраняем текущие значения перед добавлением нового номера
    const currentTotals = new Map<number, number>();
    this.matchedCardsBase().forEach((mc) => {
      currentTotals.set(mc.card.id, mc.completedTotal);
    });
    this.previousCompletedTotals.set(currentTotals);

    this.drawnNumbers.update((nums) => [...nums, number]);
    this.manualNumber.set(null);
  }

  protected removeDrawnNumber(number: number): void {
    const confirmed = confirm(`Удалить номер ${number} из выпавших? Он снова станет доступным для розыгрыша.`);
    if (confirmed) {
      // Сохраняем текущие значения перед удалением номера
      const currentTotals = new Map<number, number>();
      this.matchedCardsBase().forEach((mc) => {
        currentTotals.set(mc.card.id, mc.completedTotal);
      });
      this.previousCompletedTotals.set(currentTotals);
      
      this.drawnNumbers.update((nums) => nums.filter((n) => n !== number));
    }
  }

  protected resetGame(): void {
    this.drawnNumbers.set([]);
    this.hadFullMatch.set(new Set());
    this.showFireworks.set(false);
    this.previousCompletedTotals.set(new Map());
  }

  protected getArtistByNumber(number: number): string {
    const artist = this.artists().find((a) => a.number === number);
    return artist ? artist.name : '';
  }
}
