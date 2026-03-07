import { Routes } from '@angular/router';
import { Design } from './pages/design/design';
import { Play } from './pages/play/play';
import { PrintPreview } from './pages/print-preview/print-preview';
import { Help } from './pages/help/help';

export const routes: Routes = [
  { path: '', redirectTo: 'design', pathMatch: 'full' },
  { path: 'design', component: Design },
  { path: 'play', component: Play },
  { path: 'print-preview', component: PrintPreview },
  { path: 'help', component: Help }
];
