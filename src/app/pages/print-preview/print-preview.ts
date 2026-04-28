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
import { Tooltip } from 'primeng/tooltip';

interface BingoCell {
  name: string;
  number: number;
}

interface BingoCard {
  id: number;
  cells: BingoCell[];
  gridSize?: { rows: number; columns: number } | number;
  displayMode?: 'name' | 'number' | 'both';
}

type DisplayMode = 'name' | 'number' | 'both';

@Component({
  selector: 'app-print-preview',
  imports: [
    Button,
    Select,
    FormsModule,
    Tooltip
  ],
  templateUrl: './print-preview.html',
  styleUrl: './print-preview.css',
})
export class PrintPreview {
  protected readonly bingoCards = signal<BingoCard[]>([]);
  protected readonly displayMode = signal<DisplayMode>('both');
  protected readonly backgroundImage = signal<string | null>(null);
  protected readonly gridSize = signal<{ rows: number; columns: number }>({ rows: 5, columns: 5 });
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
              gridSize: item.gridSize || { rows: 5, columns: 5 },
              displayMode: item.displayMode || 'both',
              cells: (item.numbers || []).map((num: number, i: number) => ({
                number: num,
                name: item.artists?.[i] || `Artist ${num}`,
              })),
            }));
            this.bingoCards.set(loadedCards);
            if (loadedCards.length > 0) {
              const gridSize = loadedCards[0].gridSize;
              if (typeof gridSize === 'object' && gridSize !== null) {
                this.gridSize.set(gridSize);
              } else if (typeof gridSize === 'number') {
                this.gridSize.set({ rows: gridSize, columns: gridSize });
              }
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
        // Save whatever we have so far
        if (index > 0) {
          pdf.save(`bingo-cards-${new Date().toISOString().slice(0, 10)}-partial.pdf`);
        }
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
      await new Promise(resolve => setTimeout(resolve, 200));

      const cardElement = document.querySelector('.print-page') as HTMLElement;
      if (!cardElement) return;

      // Calculate scale for high quality (300+ DPI target)
      // A4 at 300 DPI = 2480 x 3508 pixels (portrait)
      // Using scale 6 for maximum quality
      const qualityScale = 3;

      const canvas = await html2canvas(cardElement, {
        scale: qualityScale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 30000,
        removeContainer: true,
        // Don't ignore any elements
        ignoreElements: () => false,
        // Ensure images are loaded at full quality
        onclone: (clonedDoc: unknown, element: HTMLElement) => {
          const doc = clonedDoc as globalThis.Document;
          
          // Fix text positioning for html2canvas rendering
          // Compensate for text baseline shift in canvas
          const textElements = doc.querySelectorAll('.print-card-number, .print-cell-number, .print-cell-name');
          textElements.forEach((el) => {
            const htmlEl = el as HTMLElement;
            htmlEl.style.transform = 'translateY(-10px)';
          });
          
          // Ensure images are loaded
          const images = doc.querySelectorAll('img');
          return Promise.all(
            Array.from(images).map((img) => {
              const htmlImg = img as HTMLImageElement;
              if (htmlImg.complete) {
                return Promise.resolve();
              }
              return new Promise<void>((resolve) => {
                htmlImg.onload = () => resolve();
                htmlImg.onerror = () => resolve();
              });
            })
          );
        },
      });

      // Convert canvas to blob for maximum quality (JPEG for smaller file size)
      const imgData = await new Promise<string>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => resolve(canvas.toDataURL('image/jpeg', 0.95));
            reader.readAsDataURL(blob);
          } else {
            resolve(canvas.toDataURL('image/jpeg', 0.95));
          }
        }, 'image/jpeg', 0.95);
      });

      // Добавляем страницу, кроме первой
      if (index > 0) {
        pdf.addPage(isPortrait ? 'portrait' : 'landscape');
      }

      // Добавляем изображение на страницу с полным размером
      pdf.addImage(imgData, 'JPEG', margin.left, margin.top, contentWidth, contentHeight, undefined, 'FAST');

      this.printedCount.set(index + 1);

      await saveCard(index + 1);
    };

    await saveCard(0);
  }

  protected async saveCardsAsJpg(): Promise<void> {
    const cards = this.bingoCards();
    if (cards.length === 0) return;

    this.isCancelling.set(false);

    const totalCards = cards.length;
    let savedCount = 0;

    this.isPrinting.set(true);
    this.printedCount.set(0);

    const saveCard = async (index: number) => {
      if (this.isCancelling()) {
        // Already saved files are downloaded, just stop the process
        console.log(`Saved ${savedCount} cards before cancellation`);
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
      await new Promise(resolve => setTimeout(resolve, 200));

      const cardElement = document.querySelector('.print-page') as HTMLElement;
      if (!cardElement) return;

      const card = cards[index];

      // Calculate scale for high quality (300+ DPI target)
      // A4 at 300 DPI = 2480 x 3508 pixels (portrait)
      // Using scale 6 for maximum quality
      const qualityScale = 3;

      const canvas = await html2canvas(cardElement, {
        scale: qualityScale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 30000,
        removeContainer: true,
        // Don't ignore any elements
        ignoreElements: () => false,
        // Ensure images are loaded at full quality
        onclone: (clonedDoc: unknown, element: HTMLElement) => {
          const doc = clonedDoc as globalThis.Document;
          
          // Fix text positioning for html2canvas rendering
          // Compensate for text baseline shift in canvas
          const textElements = doc.querySelectorAll('.print-card-number, .print-cell-number, .print-cell-name');
          textElements.forEach((el) => {
            const htmlEl = el as HTMLElement;
            htmlEl.style.transform = 'translateY(-10px)';
          });
          
          // Ensure images are loaded
          const images = doc.querySelectorAll('img');
          return Promise.all(
            Array.from(images).map((img) => {
              const htmlImg = img as HTMLImageElement;
              if (htmlImg.complete) {
                return Promise.resolve();
              }
              return new Promise<void>((resolve) => {
                htmlImg.onload = () => resolve();
                htmlImg.onerror = () => resolve();
              });
            })
          );
        },
      });

      const link = document.createElement('a');
      link.download = `bingo-card-${card.id}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();

      savedCount++;
      this.printedCount.set(index + 1);

      await saveCard(index + 1);
    };

    await saveCard(0);
  }

  protected async saveCurrentCardAsPdf(): Promise<void> {
    const currentCard = this.currentCard();
    if (!currentCard) return;

    const orientation = this.orientation();
    const isPortrait = orientation === 'portrait';

    const pdf = new jsPDF({
      orientation: isPortrait ? 'portrait' : 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = isPortrait ? 210 : 297;
    const pageHeight = isPortrait ? 297 : 210;
    const margin = { top: 0, right: 0, bottom: 0, left: 0 };
    const contentWidth = pageWidth - margin.left - margin.right;
    const contentHeight = pageHeight - margin.top - margin.bottom;

    const cardElement = document.querySelector('.print-page') as HTMLElement;
    if (!cardElement) return;

    const qualityScale = 6;

    const canvas = await html2canvas(cardElement, {
      scale: qualityScale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 30000,
      removeContainer: true,
      ignoreElements: () => false,
      onclone: (clonedDoc: unknown) => {
        const doc = clonedDoc as globalThis.Document;
        const textElements = doc.querySelectorAll('.print-card-number, .print-cell-number, .print-cell-name');
        textElements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          htmlEl.style.transform = 'translateY(-10px)';
        });
        const images = doc.querySelectorAll('img');
        return Promise.all(
          Array.from(images).map((img) => {
            const htmlImg = img as HTMLImageElement;
            if (htmlImg.complete) {
              return Promise.resolve();
            }
            return new Promise<void>((resolve) => {
              htmlImg.onload = () => resolve();
              htmlImg.onerror = () => resolve();
            });
          })
        );
      },
    });

    const imgData = await new Promise<string>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => resolve(canvas.toDataURL('image/jpeg', 0.95));
          reader.readAsDataURL(blob);
        } else {
          resolve(canvas.toDataURL('image/jpeg', 0.95));
        }
      }, 'image/jpeg', 0.95);
    });

    pdf.addImage(imgData, 'JPEG', margin.left, margin.top, contentWidth, contentHeight, undefined, 'FAST');
    pdf.save(`bingo-card-${currentCard.id}.pdf`);
  }

  protected async saveCurrentCardAsJpg(): Promise<void> {
    const currentCard = this.currentCard();
    if (!currentCard) return;

    const cardElement = document.querySelector('.print-page') as HTMLElement;
    if (!cardElement) return;

    const qualityScale = 6;

    const canvas = await html2canvas(cardElement, {
      scale: qualityScale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 30000,
      removeContainer: true,
      ignoreElements: () => false,
      onclone: (clonedDoc: unknown) => {
        const doc = clonedDoc as globalThis.Document;
        const textElements = doc.querySelectorAll('.print-card-number, .print-cell-number, .print-cell-name');
        textElements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          htmlEl.style.transform = 'translateY(-10px)';
        });
        const images = doc.querySelectorAll('img');
        return Promise.all(
          Array.from(images).map((img) => {
            const htmlImg = img as HTMLImageElement;
            if (htmlImg.complete) {
              return Promise.resolve();
            }
            return new Promise<void>((resolve) => {
              htmlImg.onload = () => resolve();
              htmlImg.onerror = () => resolve();
            });
          })
        );
      },
    });

    const link = document.createElement('a');
    link.download = `bingo-card-${currentCard.id}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
  }

  protected getEffectiveGridSize(): { rows: number; columns: number } {
    const cards = this.bingoCards();
    if (cards.length > 0 && cards[0].gridSize) {
      const gridSize = cards[0].gridSize;
      if (typeof gridSize === 'object') {
        return gridSize;
      }
      return { rows: gridSize, columns: gridSize };
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

    const gridSize = this.getEffectiveGridSize();
    const cellWidth = Math.floor(tableWidthTwips / gridSize.columns);
    const cellHeight = Math.floor(tableHeightTwips / gridSize.rows);
    const displayMode = this.displayMode();
    const numberFontSize = this.cellNumberFontSize() * 2;
    const nameFontSize = this.cellNameFontSize() * 2;

    const sections = cards.map((card) => this.createCardSection(card, isPortrait, pageSize, margin, gridSize, cellWidth, cellHeight, displayMode, numberFontSize, nameFontSize, tableWidthTwips));

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
    gridSize: { rows: number; columns: number },
    cellWidth: number,
    cellHeight: number,
    displayMode: DisplayMode,
    numberFontSize: number,
    nameFontSize: number,
    tableWidthTwips: number
  ) {
    const tableRows: TableRow[] = [];

    for (let row = 0; row < gridSize.rows; row++) {
      const cells: TableCell[] = [];
      for (let col = 0; col < gridSize.columns; col++) {
        const cellIndex = row * gridSize.columns + col;
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
