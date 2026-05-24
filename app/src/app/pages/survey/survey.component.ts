import { Component, signal, inject } from '@angular/core';
import { ConsentStepComponent } from './steps/consent.component';
import { DemographicsStepComponent } from './steps/demographics.component';
import { TasksStepComponent, SURVEY_TASKS } from './steps/tasks.component';
import { TlxStepComponent } from './steps/tlx.component';
import { LikertStepComponent } from './steps/likert.component';
import { CompletedStepComponent } from './steps/completed.component';
import { SurveySubmissionService } from './survey-submission.service';
import type { SurveyData, TlxDimension, LikertPrompt } from './survey.types';

const TLX_DIMENSIONS: TlxDimension[] = [
  { category: 'Mental Demand', text: 'How mentally demanding was the task?', lmin: 'Very Low', lmax: 'Very High' },
  { category: 'Physical Demand', text: 'How physically demanding was the task?', lmin: 'Very Low', lmax: 'Very High' },
  { category: 'Temporal Demand', text: 'How hurried or rushed was the pace of the task?', lmin: 'Very Low', lmax: 'Very High' },
  { category: 'Performance', text: 'How successful were you in accomplishing what you were asked to do?', lmin: 'Perfect', lmax: 'Failure' },
  { category: 'Effort', text: 'How hard did you have to work to accomplish your level of performance?', lmin: 'Very Low', lmax: 'Very High' },
  { category: 'Frustration', text: 'How insecure, discouraged, irritated, stressed, and annoyed were you?', lmin: 'Very Low', lmax: 'Very High' },
];

const LIKERT_PROMPTS: LikertPrompt[] = [
  { text: 'How confident are you of the answers you gave', lmin: 'Not at all Confident', lmax: 'Highly Confident' },
  { text: 'How satisfied you are with the tool', lmin: 'Very Dissatisfied', lmax: 'Very Satisfied' },
  { text: 'How likely are you to recommend the tool to a friend or colleague?', lmin: 'Not Likely', lmax: 'Very Likely' },
];

function createInitialData(): SurveyData {
  return {
    startUrl: 'https://explorer.csrg.cl',
    user: { gender: 'male', age: null, degree: null },
    tasks: Array.from({ length: 10 }, () => ({ on: null, sparql: null, time: null })),
    tlx: [
      { on: null, score: [50, 50, 50, 50, 50, 50] },
      { on: null, score: [50, 50, 50, 50, 50, 50] },
    ],
    likert: [
      { on: null, score: [3, 3, 3] },
      { on: null, score: [3, 3, 3] },
    ],
  };
}

@Component({
  selector: 'app-survey',
  templateUrl: './survey.component.html',
  styleUrl: './survey.component.scss',
  standalone: true,
  imports: [
    ConsentStepComponent,
    DemographicsStepComponent,
    TasksStepComponent,
    TlxStepComponent,
    LikertStepComponent,
    CompletedStepComponent,
  ],
})
export class SurveyComponent {
  private readonly submission = inject(SurveySubmissionService);

  readonly tlxDimensions = TLX_DIMENSIONS;
  readonly likertPrompts = LIKERT_PROMPTS;
  readonly taskTexts = SURVEY_TASKS;

  readonly data = signal<SurveyData>(createInitialData());
  readonly step = signal(0);
  readonly urlStep = signal(0);
  readonly taskStep = signal(0);

  readonly urls = signal<string[]>([
    'https://explorer.csrg.cl',
    'https://query.wikidata.org',
  ]);

  private clock: number | null = null;

  subtitle(): string {
    const s = this.step();
    if (s === 1) return 'Part 1: User identification';
    if (s === 2) return `Part 2: Task ${this.taskStep() + 1} of 10`;
    if (s === 3) return `Part 3: Nasa-TLX for ${this.urls()[this.urlStep()].slice(8)}`;
    if (s === 4) return `Part 4: Likert for ${this.urls()[this.urlStep()].slice(8)}`;
    return '';
  }

  next(): void {
    switch (this.step()) {
      case 0: {
        const d = this.data();
        if (d.startUrl === 'https://explorer.csrg.cl') {
          this.urls.set(['https://explorer.csrg.cl', 'https://query.wikidata.org']);
        } else {
          this.urls.set(['https://query.wikidata.org', 'https://explorer.csrg.cl']);
        }
        this.step.update(s => s + 1);
        break;
      }
      case 1: {
        document.getElementById('top')?.scrollIntoView({ behavior: 'smooth' });
        this.step.update(s => s + 1);
        this.clock = Date.now();
        break;
      }
      case 2: {
        document.getElementById('top')?.scrollIntoView({ behavior: 'smooth' });
        const d = { ...this.data() };
        const tasks = [...d.tasks];
        const ti = this.taskStep();
        tasks[ti] = {
          ...tasks[ti],
          on: this.urls()[this.urlStep()],
          time: this.clock ? (Date.now() - this.clock) / 1000 : 0,
        };
        d.tasks = tasks;
        this.clock = Date.now();
        this.taskStep.update(t => t + 1);
        this.urlStep.update(u => (u + 1) % 2);
        if (this.taskStep() === 10) {
          this.step.update(s => s + 1);
          this.urlStep.set(0);
        }
        this.data.set(d);
        break;
      }
      case 3: {
        document.getElementById('top')?.scrollIntoView({ behavior: 'smooth' });
        const d = { ...this.data() };
        const tlx = [...d.tlx];
        const ui = this.urlStep();
        if (ui === 0) {
          tlx[ui] = { ...tlx[ui], on: this.urls()[ui] };
          this.urlStep.set(1);
        } else {
          tlx[ui] = { ...tlx[ui], on: this.urls()[ui] };
          this.urlStep.set(0);
          this.step.update(s => s + 1);
        }
        d.tlx = tlx;
        this.data.set(d);
        break;
      }
      case 4: {
        document.getElementById('top')?.scrollIntoView({ behavior: 'smooth' });
        const d = { ...this.data() };
        const likert = [...d.likert];
        const ui = this.urlStep();
        if (ui === 0) {
          likert[ui] = { ...likert[ui], on: this.urls()[ui] };
          this.urlStep.set(1);
        } else {
          likert[ui] = { ...likert[ui], on: this.urls()[ui] };
          this.urlStep.set(0);
          this.step.update(s => s + 1);
          this.submission.submit(d).catch(console.error);
        }
        d.likert = likert;
        this.data.set(d);
        break;
      }
    }
  }

  downloadData(): void {
    this.submission.download(this.data());
  }

  onStartUrlChange(value: 'https://explorer.csrg.cl' | 'https://query.wikidata.org'): void {
    this.data.update(d => ({ ...d, startUrl: value }));
  }

  onGenderChange(value: string): void {
    this.data.update(d => ({ ...d, user: { ...d.user, gender: value } }));
  }

  onAgeChange(value: number | null): void {
    this.data.update(d => ({ ...d, user: { ...d.user, age: value } }));
  }

  onDegreeChange(value: string | null): void {
    this.data.update(d => ({ ...d, user: { ...d.user, degree: value } }));
  }

  onTaskSparqlChange(value: string | null): void {
    const d = { ...this.data() };
    const tasks = [...d.tasks];
    tasks[this.taskStep()] = { ...tasks[this.taskStep()], sparql: value };
    d.tasks = tasks;
    this.data.set(d);
  }

  onTlxScoresChange(values: number[]): void {
    const d = { ...this.data() };
    const tlx = [...d.tlx];
    tlx[this.urlStep()] = { ...tlx[this.urlStep()], score: values };
    d.tlx = tlx;
    this.data.set(d);
  }

  onLikertScoresChange(values: number[]): void {
    const d = { ...this.data() };
    const likert = [...d.likert];
    likert[this.urlStep()] = { ...likert[this.urlStep()], score: values };
    d.likert = likert;
    this.data.set(d);
  }
}
