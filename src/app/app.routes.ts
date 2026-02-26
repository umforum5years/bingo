import { Routes } from '@angular/router';
import { Design } from './pages/design/design';
import { Play } from './pages/play/play';

export const routes: Routes = [
  { path: '', redirectTo: 'design', pathMatch: 'full' },
  { path: 'design', component: Design },
  { path: 'play', component: Play }
];
