import { Component, input, output } from '@angular/core';
import type { LikertPrompt } from '../survey.types';

@Component({
  selector: 'app-likert-step',
  standalone: true,
  template: `
    <div id="likert">
      <h5>
        Answer the following questions based on your experience using
        <a [href]="currentUrl()" target="_blank">{{ currentUrl() }}</a>
      </h5>
      <form class="mt-4">
        @for (prompt of prompts(); track prompt.text; let idx = $index) {
          <label style="font-weight: bolder;" [for]="'likert' + idx">{{ prompt.text }}</label>
          <input class="custom-range w-100" [id]="'likert' + idx" type="range" min="1" max="5"
            [value]="scores()[idx]"
            (input)="onScoreChange(idx, $event)" />
          <div class="mb-4" style="font-weight: lighter;">
            <span>{{ prompt.lmin }}</span>
            <span class="pull-right">{{ prompt.lmax }}</span>
          </div>
        }
        <div class="form-group row">
          <div class="col-sm-12">
            <button class="btn btn-primary pull-right" type="button" (click)="advance.emit()">Next</button>
          </div>
        </div>
      </form>
    </div>
  `,
  styles: [`
    :host { display: contents; }
    .btn-primary { background-color: #007bff; border-color: #007bff; color: #fff; padding: 0.375rem 0.75rem; font-size: 1rem; border-radius: 0.25rem; cursor: pointer; }
    .pull-right { float: right; }
    .form-group { margin-bottom: 1rem; }
    .mb-4 { margin-bottom: 1.5rem; }
    .mt-4 { margin-top: 1.5rem; }
    .row { display: flex; flex-wrap: wrap; margin-right: -15px; margin-left: -15px; }
    .col-sm-12 { flex: 0 0 100%; max-width: 100%; padding-right: 15px; padding-left: 15px; }
    .custom-range { width: 100%; }
    a { color: #007bff; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .w-100 { width: 100%; }
  `]
})
export class LikertStepComponent {
  readonly prompts = input.required<LikertPrompt[]>();
  readonly scores = input.required<number[]>();
  readonly scoresChange = output<number[]>();
  readonly currentUrl = input.required<string>();
  readonly advance = output<void>();

  onScoreChange(idx: number, event: Event): void {
    const val = +(event.target as HTMLInputElement).value;
    const updated = [...this.scores()];
    updated[idx] = val;
    this.scoresChange.emit(updated);
  }
}
