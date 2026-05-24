import { Routes } from '@angular/router';
import { MainComponent } from './pages/main/main.component';
import { SurveyPlaceholderComponent } from './pages/survey/survey-placeholder.component';

export const routes: Routes = [
  { path: '', component: MainComponent },
  { path: 'survey', component: SurveyPlaceholderComponent },
  { path: '**', redirectTo: '' }
];
