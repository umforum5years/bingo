import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { SelectButton } from 'primeng/selectbutton';
import { ToastModule } from 'primeng/toast';
import { Tooltip } from 'primeng/tooltip';
import { FireworksComponent } from '../../components/fireworks/fireworks.component';

interface Artist {
  name: string;
  number: number;
}

type DisplayMode = 'name' | 'number' | 'both';

type MatchedSortType = 'matchedCount' | 'completedTotal';

interface BingoCard {
  id: number;
  gridSize?: { rows: number; columns: number } | number;
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
    ToastModule,
    Dialog,
    FireworksComponent
  ],
  templateUrl: './play.html',
  styleUrl: './play.css',
  providers: [MessageService],
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
  protected readonly shownMilestones = signal<Map<number, number[]>>(new Map());
  protected readonly shownFullMatch = signal<Set<number>>(new Set());
  protected readonly countDiagonals = signal<boolean>(true);
  protected readonly showAchievementsPanel = signal<boolean>(false);
  protected readonly milestoneAchievements = signal<Array<{ cardId: number; milestone: number | 'BINGO'; timestamp: number }>>([]);

  private readonly STORAGE_KEY = 'bingo-game-state';

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
        
        let gridSize = { rows: 5, columns: 5 };
        if (card.gridSize) {
          if (typeof card.gridSize === 'object') {
            gridSize = card.gridSize;
          } else {
            gridSize = { rows: card.gridSize, columns: card.gridSize };
          }
        }

        // Подсчёт заполненных строк
        let completedRows = 0;
        for (let row = 0; row < gridSize.rows; row++) {
          const rowStart = row * gridSize.columns;
          const rowNumbers = card.numbers.slice(rowStart, rowStart + gridSize.columns);
          const allMatched = rowNumbers.every((n) => drawn.includes(n));
          if (allMatched) completedRows++;
        }

        // Подсчёт заполненных столбцов
        let completedCols = 0;
        for (let col = 0; col < gridSize.columns; col++) {
          const colNumbers: number[] = [];
          for (let row = 0; row < gridSize.rows; row++) {
            colNumbers.push(card.numbers[row * gridSize.columns + col]);
          }
          const allMatched = colNumbers.every((n) => drawn.includes(n));
          if (allMatched) completedCols++;
        }

        // Подсчёт заполненных диагоналей (только для квадратных сеток)
        let completedDiagonals = 0;

        if (gridSize.rows === gridSize.columns && this.countDiagonals()) {
          const size = gridSize.rows;
          // Главная диагональ (слева-сверху вправо-вниз)
          const mainDiagonalNumbers: number[] = [];
          for (let i = 0; i < size; i++) {
            mainDiagonalNumbers.push(card.numbers[i * size + i]);
          }
          if (mainDiagonalNumbers.every((n) => drawn.includes(n))) {
            completedDiagonals++;
          }

          // Побочная диагональ (справа-сверху влево-вниз)
          const antiDiagonalNumbers: number[] = [];
          for (let i = 0; i < size; i++) {
            antiDiagonalNumbers.push(card.numbers[i * size + (size - 1 - i)]);
          }
          if (antiDiagonalNumbers.every((n) => drawn.includes(n))) {
            completedDiagonals++;
          }
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

  protected readonly getCompletedTotalForMilestones = computed(() => {
    const countDiags = this.countDiagonals();
    return (mc: MatchedCard) => {
      return countDiags 
        ? mc.completedRows + mc.completedCols + mc.completedDiagonals
        : mc.completedRows + mc.completedCols;
    };
  });

  private readonly messageService = inject(MessageService);

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
          this.showFullMatchToast(card.card.id);
        }
      }
    }, { allowSignalWrites: true });

    effect(() => {
      this.checkAndShowMilestones();
    });

    effect(() => {
      this.saveGameState();
    });

    this.restoreGameState();
  }

  private triggerFireworks(): void {
    this.showFireworks.set(true);
  }

  private checkAndShowMilestones(): void {
    const matched = this.matchedCards();
    const milestones = [1, 2, 3, 4, 5];
    const shownMilestones = this.shownMilestones();
    const getCompletedTotal = this.getCompletedTotalForMilestones();

    for (const milestone of milestones) {
      // Находим все бланки, которые достигли этого milestone
      const cardsWithMilestone = matched.filter(mc => getCompletedTotal(mc) >= milestone);

      // Если milestone ещё не был показан
      if (!shownMilestones.has(milestone) && cardsWithMilestone.length > 0) {
        // Находим минимальное значение completedTotal среди всех бланков
        const minCompleted = Math.min(...cardsWithMilestone.map(mc => getCompletedTotal(mc)));

        // Берём только те бланки, которые достигли milestone первыми (с минимальным completedTotal)
        const firstCards = cardsWithMilestone.filter(mc => getCompletedTotal(mc) === minCompleted);

        // Показываем сообщение для каждого первого бланка
        for (const fc of firstCards) {
          this.showToastMilestone(fc.card.id, milestone);
        }

        // Помечаем milestone как показанный
        this.shownMilestones.update(map => {
          const newMap = new Map(map);
          newMap.set(milestone, firstCards.map(c => c.card.id));
          return newMap;
        });
      }
    }
  }

  private showToastMilestone(cardId: number, milestone: number): void {
    let message = '';
    switch (milestone) {
      case 1:
        message = `Бланк №${cardId} собрал первую линию! 🎉`;
        break;
      case 2:
        message = `Бланк №${cardId} собрал две линии! 🎉🎉`;
        break;
      case 3:
        message = `Бланк №${cardId} собрал три линии! 🎉🎉🎉`;
        break;
      case 4:
        message = `Бланк №${cardId} собрал четыре линии! 🎉🎉🎉🎉`;
        break;
      case 5:
        message = `Бланк №${cardId} собрал пять линий! 🔥🔥🔥`;
        break;
    }

    if (message) {
      this.messageService.add({
        severity: 'success',
        summary: 'Достижение!',
        detail: message,
        life: 5000,
      });

      this.milestoneAchievements.update(achievements => [
        ...achievements,
        { cardId, milestone, timestamp: Date.now() }
      ]);
    }
  }

  private showFullMatchToast(cardId: number): void {
    if (!this.shownFullMatch().has(cardId)) {
      this.shownFullMatch.update(set => {
        const newSet = new Set(set);
        newSet.add(cardId);
        return newSet;
      });

      this.messageService.add({
        severity: 'success',
        summary: 'БИНГО!',
        detail: `Бланк №${cardId} собрал все числа! 🎊🎊🎊`,
        life: 5000,
      });

      this.milestoneAchievements.update(achievements => [
        ...achievements,
        { cardId, milestone: 'BINGO', timestamp: Date.now() }
      ]);
    }
  }

  private saveGameState(): void {
    const state = {
      artists: this.artists(),
      bingoCards: this.bingoCards(),
      drawnNumbers: this.drawnNumbers(),
      hadFullMatch: Array.from(this.hadFullMatch()),
      previousCompletedTotals: Array.from(this.previousCompletedTotals().entries()),
      shownMilestones: Array.from(this.shownMilestones().entries()),
      shownFullMatch: Array.from(this.shownFullMatch()),
      countDiagonals: this.countDiagonals(),
      milestoneAchievements: this.milestoneAchievements(),
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
  }

  private restoreGameState(): void {
    const savedState = localStorage.getItem(this.STORAGE_KEY);
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        if (state.artists) this.artists.set(state.artists);
        if (state.bingoCards) this.bingoCards.set(state.bingoCards);
        if (state.drawnNumbers) this.drawnNumbers.set(state.drawnNumbers);
        if (state.hadFullMatch) this.hadFullMatch.set(new Set(state.hadFullMatch));
        if (state.previousCompletedTotals) {
          this.previousCompletedTotals.set(new Map(state.previousCompletedTotals));
        }
        if (state.shownMilestones) {
          this.shownMilestones.set(new Map(state.shownMilestones));
        }
        if (state.shownFullMatch) {
          this.shownFullMatch.set(new Set(state.shownFullMatch));
        }
        if (state.countDiagonals !== undefined) {
          this.countDiagonals.set(state.countDiagonals);
        }
        if (state.milestoneAchievements) {
          this.milestoneAchievements.set(state.milestoneAchievements);
        }
      } catch (e) {
        console.error('Failed to restore game state:', e);
      }
    }
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
            localStorage.removeItem(this.STORAGE_KEY);
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
            localStorage.removeItem(this.STORAGE_KEY);
          }
        } catch {
          console.error('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    }
  }

  protected saveGame(): void {
    const state = {
      artists: this.artists(),
      bingoCards: this.bingoCards(),
      drawnNumbers: this.drawnNumbers(),
      hadFullMatch: Array.from(this.hadFullMatch()),
      previousCompletedTotals: Array.from(this.previousCompletedTotals().entries()),
      shownMilestones: Array.from(this.shownMilestones().entries()),
      shownFullMatch: Array.from(this.shownFullMatch()),
      countDiagonals: this.countDiagonals(),
      milestoneAchievements: this.milestoneAchievements(),
    };
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bingo-game-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  protected loadGame(): void {
    const fileInput = document.getElementById('loadGameFileInput') as HTMLInputElement;
    fileInput?.click();
  }

  protected onGameFileLoad(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const state = JSON.parse(e.target?.result as string);
          if (state.artists) this.artists.set(state.artists);
          if (state.bingoCards) this.bingoCards.set(state.bingoCards);
          if (state.drawnNumbers) this.drawnNumbers.set(state.drawnNumbers);
          if (state.hadFullMatch) this.hadFullMatch.set(new Set(state.hadFullMatch));
          if (state.previousCompletedTotals) {
            this.previousCompletedTotals.set(new Map(state.previousCompletedTotals));
          }
          if (state.shownMilestones) {
            this.shownMilestones.set(new Map(state.shownMilestones));
          }
          if (state.shownFullMatch) {
            this.shownFullMatch.set(new Set(state.shownFullMatch));
          }
          if (state.countDiagonals !== undefined) {
            this.countDiagonals.set(state.countDiagonals);
          }
          if (state.milestoneAchievements) {
            this.milestoneAchievements.set(state.milestoneAchievements);
          }
          localStorage.removeItem(this.STORAGE_KEY);
        } catch {
          console.error('Invalid game state file');
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
    this.shownMilestones.set(new Map());
    this.shownFullMatch.set(new Set());
    this.countDiagonals.set(true);
    this.milestoneAchievements.set([]);
    localStorage.removeItem(this.STORAGE_KEY);
  }

  protected getArtistByNumber(number: number): string {
    const artist = this.artists().find((a) => a.number === number);
    return artist ? artist.name : '';
  }

  protected getMilestoneLabel(milestone: number | 'BINGO'): string {
    if (milestone === 'BINGO') return 'чисел';
    if (milestone === 1) return 'линию';
    if (milestone === 2) return 'линии';
    if (milestone === 3) return 'линии';
    if (milestone === 4) return 'линии';
    if (milestone === 5) return 'линий';
    return 'линий';
  }

  protected getAchievementTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours} ч. назад`;
    } else if (minutes > 0) {
      return `${minutes} мин. назад`;
    } else {
      return `${seconds} сек. назад`;
    }
  }

  protected getGridSizeDisplay(gridSize?: { rows: number; columns: number } | number): string {
    if (!gridSize) return '5x5';
    if (typeof gridSize === 'object') {
      return `${gridSize.rows}x${gridSize.columns}`;
    }
    return `${gridSize}x${gridSize}`;
  }

  protected getGridColumns(gridSize?: { rows: number; columns: number } | number): number {
    if (!gridSize) return 5;
    if (typeof gridSize === 'object') {
      return gridSize.columns;
    }
    return gridSize;
  }

  protected getGridRows(gridSize?: { rows: number; columns: number } | number): number {
    if (!gridSize) return 5;
    if (typeof gridSize === 'object') {
      return gridSize.rows;
    }
    return gridSize;
  }
}
