import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';

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
  protected readonly cellNumberFontSize = signal<number>(16);
  protected readonly cellNameFontSize = signal<number>(12);
  protected readonly currentIndex = signal<number>(0);
  protected readonly isPrinting = signal<boolean>(false);
  protected readonly printedCount = signal<number>(0);
  protected readonly isCancelling = signal<boolean>(false);

  protected readonly displayModes: { label: string; value: DisplayMode }[] = [
    { label: 'Название и номер', value: 'both' },
    { label: 'Только название', value: 'name' },
    { label: 'Только номер', value: 'number' },
  ];

  protected readonly orientations: { label: string; value: 'portrait' | 'landscape' }[] = [
    { label: 'Портретная (A4)', value: 'portrait' },
    { label: 'Альбомная (A4)', value: 'landscape' },
  ];

  protected readonly currentCard = computed(() => {
    const cards = this.bingoCards();
    const index = this.currentIndex();
    return cards[index] ?? null;
  });

  protected readonly totalCards = computed(() => this.bingoCards().length);

  protected readonly isFirstCard = computed(() => this.currentIndex() === 0);

  protected readonly isLastCard = computed(() => {
    const cards = this.bingoCards();
    return this.currentIndex() >= cards.length - 1;
  });

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

  protected navigateToFirst(): void {
    this.currentIndex.set(0);
  }

  protected navigateToPrevious(): void {
    const index = this.currentIndex();
    if (index > 0) {
      this.currentIndex.set(index - 1);
    }
  }

  protected navigateToNext(): void {
    const cards = this.bingoCards();
    const index = this.currentIndex();
    if (index < cards.length - 1) {
      this.currentIndex.set(index + 1);
    }
  }

  protected navigateToLast(): void {
    const cards = this.bingoCards();
    this.currentIndex.set(cards.length - 1);
  }

  protected cancelOperation(): void {
    this.isCancelling.set(true);
  }

  protected async saveAsPdf(): Promise<void> {
    const cards = this.bingoCards();
    if (cards.length === 0) return;

    this.isCancelling.set(false);

    const totalCards = cards.length;
    const orientation = this.orientation();
    const isPortrait = orientation === 'portrait';

    // A4 размеры в мм
    const pdf = new jsPDF({
      orientation: isPortrait ? 'portrait' : 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = isPortrait ? 210 : 297;
    const pageHeight = isPortrait ? 297 : 210;

    // Поля в мм
    const margin = { top: 0, right: 0, bottom: 0, left: 0 };
    const contentWidth = pageWidth - margin.left - margin.right;
    const contentHeight = pageHeight - margin.top - margin.bottom;

    this.isPrinting.set(true);
    this.printedCount.set(0);

    const saveCard = async (index: number) => {
      if (this.isCancelling()) {
        this.isPrinting.set(false);
        this.printedCount.set(0);
        this.isCancelling.set(false);
        return;
      }

      if (index >= totalCards) {
        pdf.save(`bingo-cards-${new Date().toISOString().slice(0, 10)}.pdf`);
        this.isPrinting.set(false);
        this.printedCount.set(0);
        this.isCancelling.set(false);
        return;
      }

      this.currentIndex.set(index);

      // Даём DOM обновиться
      await new Promise(resolve => setTimeout(resolve, 100));

      const cardElement = document.querySelector('.print-page') as HTMLElement;
      if (!cardElement) return;

      // Calculate scale for high quality (300+ DPI target)
      // A4 at 300 DPI = 2480 x 3508 pixels (portrait)
      // A4 at 300 DPI = 3508 x 2480 pixels (landscape)
      // Screen is typically 96 DPI, so scale = 300/96 ≈ 3.125
      // Using scale 10 for maximum quality and to ensure crisp text
      const qualityScale = 10;

      const canvas = await html2canvas(cardElement, {
        scale: qualityScale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 0,
        removeContainer: true,
        // Force high-resolution rendering
        width: cardElement.offsetWidth,
        height: cardElement.offsetHeight,
        // Ensure images are rendered at full quality
        onclone: (clonedDoc: unknown, element: HTMLElement) => {
          // Force all images in the clone to load before rendering
          const doc = clonedDoc as globalThis.Document;
          const images = doc.querySelectorAll('img');
          Array.from(images).forEach((img) => {
            const htmlImg = img as HTMLImageElement;
            if (!htmlImg.complete) {
              // Images should already be loaded, but just in case
              htmlImg.onload = () => {};
              htmlImg.onerror = () => {};
            }
          });
        },
      });

      const imgData = canvas.toDataURL('image/png', 1.0);

      // Добавляем страницу, кроме первой
      if (index > 0) {
        pdf.addPage(isPortrait ? 'portrait' : 'landscape');
      }

      // Добавляем изображение на страницу с полным размером
      pdf.addImage(imgData, 'PNG', margin.left, margin.top, contentWidth, contentHeight, undefined, 'FAST');

      this.printedCount.set(index + 1);

      await saveCard(index + 1);
    };

    await saveCard(0);
  }

  protected async saveCardsAsPng(): Promise<void> {
    const cards = this.bingoCards();
    if (cards.length === 0) return;

    this.isCancelling.set(false);

    const totalCards = cards.length;
    let savedCount = 0;

    this.isPrinting.set(true);
    this.printedCount.set(0);

    const saveCard = async (index: number) => {
      if (this.isCancelling()) {
        this.isPrinting.set(false);
        this.printedCount.set(0);
        this.isCancelling.set(false);
        return;
      }

      if (index >= totalCards) {
        this.isPrinting.set(false);
        this.printedCount.set(0);
        this.isCancelling.set(false);
        return;
      }

      this.currentIndex.set(index);

      // Даём DOM обновиться
      await new Promise(resolve => setTimeout(resolve, 50));

      const cardElement = document.querySelector('.print-page') as HTMLElement;
      if (!cardElement) return;

      const card = cards[index];

      // Calculate scale for high quality (300+ DPI target)
      // A4 at 300 DPI = 2480 x 3508 pixels (portrait)
      // A4 at 300 DPI = 3508 x 2480 pixels (landscape)
      // Using scale 10 for maximum quality
      const qualityScale = 10;

      const canvas = await html2canvas(cardElement, {
        scale: qualityScale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 0,
        removeContainer: true,
        // Force high-resolution rendering
        width: cardElement.offsetWidth,
        height: cardElement.offsetHeight,
        // Ensure images are rendered at full quality
        onclone: (clonedDoc: unknown, element: HTMLElement) => {
          // Force all images in the clone to load before rendering
          const doc = clonedDoc as globalThis.Document;
          const images = doc.querySelectorAll('img');
          Array.from(images).forEach((img) => {
            const htmlImg = img as HTMLImageElement;
            if (!htmlImg.complete) {
              // Images should already be loaded, but just in case
              htmlImg.onload = () => {};
              htmlImg.onerror = () => {};
            }
          });
        },
      });

      const link = document.createElement('a');
      link.download = `bingo-card-${card.id}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();

      savedCount++;
      this.printedCount.set(index + 1);

      await saveCard(index + 1);
    };

    await saveCard(0);
  }

  protected getEffectiveGridSize(): number {
    const cards = this.bingoCards();
    if (cards.length > 0 && cards[0].gridSize) {
      return cards[0].gridSize;
    }
    return this.gridSize();
  }

  protected async saveToWord(): Promise<void> {
    const cards = this.bingoCards();
    if (cards.length === 0) {
      alert('Сначала создайте бланки');
      return;
    }

    const orientation = this.orientation();
    const isPortrait = orientation === 'portrait';
    const pageSize = isPortrait
      ? { width: 11906, height: 16838 }
      : { width: 16838, height: 11906 };

    const TWIPS_PER_CM = 567;
    const tableWidthTwips = 18 * TWIPS_PER_CM;
    const tableHeightTwips = isPortrait ? 18 * TWIPS_PER_CM : 16 * TWIPS_PER_CM;

    const margin = isPortrait
      ? { top: 2835, right: 567, bottom: 2835, left: 567 }
      : { top: 567, right: 567, bottom: 567, left: 567 };

    const size = this.getEffectiveGridSize();
    const cellWidth = Math.floor(tableWidthTwips / size);
    const cellHeight = Math.floor(tableHeightTwips / size);
    const displayMode = this.displayMode();
    const numberFontSize = this.cellNumberFontSize() * 2;
    const nameFontSize = this.cellNameFontSize() * 2;

    const sections = cards.map((card) => this.createCardSection(card, isPortrait, pageSize, margin, size, cellWidth, cellHeight, displayMode, numberFontSize, nameFontSize, tableWidthTwips));

    const doc: Document = new Document({
      sections,
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `bingo-cards-${new Date().toISOString().slice(0, 10)}.docx`);
  }

  private createCardSection(
    card: BingoCard,
    isPortrait: boolean,
    pageSize: { width: number; height: number },
    margin: { top: number; right: number; bottom: number; left: number },
    size: number,
    cellWidth: number,
    cellHeight: number,
    displayMode: DisplayMode,
    numberFontSize: number,
    nameFontSize: number,
    tableWidthTwips: number
  ) {
    const tableRows: TableRow[] = [];

    for (let row = 0; row < size; row++) {
      const cells: TableCell[] = [];
      for (let col = 0; col < size; col++) {
        const cellIndex = row * size + col;
        const cell = card.cells[cellIndex];

        const cellChildren: any[] = [];

        if (displayMode === 'number') {
          cellChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: cell.number.toString(),
                  size: numberFontSize,
                  bold: true,
                }),
              ],
              alignment: AlignmentType.CENTER,
            })
          );
        } else if (displayMode === 'name') {
          cellChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: cell.name,
                  size: nameFontSize,
                }),
              ],
              alignment: AlignmentType.CENTER,
            })
          );
        } else {
          cellChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: cell.number.toString(),
                  size: numberFontSize,
                  bold: true,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 50 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: cell.name,
                  size: nameFontSize,
                }),
              ],
              alignment: AlignmentType.CENTER,
            })
          );
        }

        cells.push(
          new TableCell({
            children: cellChildren,
            width: { size: cellWidth, type: WidthType.DXA },
            verticalAlign: 'center',
          })
        );
      }
      tableRows.push(
        new TableRow({
          children: cells,
          height: { value: cellHeight, rule: 'exact' },
        })
      );
    }

    const cardTable = new Table({
      rows: tableRows,
      width: { size: tableWidthTwips, type: WidthType.DXA },
      alignment: AlignmentType.CENTER,
    });

    const cardNumber = new Paragraph({
      children: [
        new TextRun({
          text: `№${card.id}`,
          size: 28,
          bold: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 100 },
    });

    return {
      properties: {
        page: {
          size: {
            width: pageSize.width,
            height: pageSize.height,
          },
          margin,
        },
      },
      children: [cardNumber, cardTable],
    };
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
