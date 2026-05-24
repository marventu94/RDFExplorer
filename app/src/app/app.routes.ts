import { Routes } from '@angular/router';
import { MainComponent } from './pages/main/main.component';
import { SurveyComponent } from './pages/survey/survey.component';

export const routes: Routes = [
  { path: '', component: MainComponent },
  { path: 'survey', component: SurveyComponent },
  { path: '**', redirectTo: '' }
];
