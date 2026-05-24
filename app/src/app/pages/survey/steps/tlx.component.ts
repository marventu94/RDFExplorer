import { Component, input, output } from '@angular/core';
import type { TlxDimension } from '../survey.types';

@Component({
  selector: 'app-tlx-step',
  standalone: true,
  template: `
    <div id="nasa-tlx">
      <h5>
        Answer the following questions based on your experience using
        <a [href]="currentUrl()" target="_blank">{{ currentUrl() }}</a>
      </h5>
      <form class="mt-4">
        @for (dim of dimensions(); track dim.category; let idx = $index) {
          <div class="row mb-2" style="font-weight: bolder;">
            <div class="col-sm-8">{{ dim.text }}</div>
            <div class="col-sm-4">
              <label class="pull-right" [for]="'tlx' + idx">{{ dim.category }}</label>
            </div>
          </div>
          <input class="custom-range w-100" [id]="'tlx' + idx" type="range" step="5" min="0" max="100"
            [value]="scores()[idx]"
            (input)="onScoreChange(idx, $event)" />
          <div class="mb-4" style="font-weight: lighter;">
            <span>{{ dim.lmin }}</span>
            <span class="pull-right">{{ dim.lmax }}</span>
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
    .mb-2 { margin-bottom: 0.5rem; }
    .mb-4 { margin-bottom: 1.5rem; }
    .mt-4 { margin-top: 1.5rem; }
    .row { display: flex; flex-wrap: wrap; margin-right: -15px; margin-left: -15px; }
    .col-sm-4 { flex: 0 0 33.333333%; max-width: 33.333333%; padding-right: 15px; padding-left: 15px; }
    .col-sm-8 { flex: 0 0 66.666667%; max-width: 66.666667%; padding-right: 15px; padding-left: 15px; }
    .col-sm-12 { flex: 0 0 100%; max-width: 100%; padding-right: 15px; padding-left: 15px; }
    .custom-range { width: 100%; }
    a { color: #007bff; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .w-100 { width: 100%; }
  `]
})
export class TlxStepComponent {
  readonly dimensions = input.required<TlxDimension[]>();
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
