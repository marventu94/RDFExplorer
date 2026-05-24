import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export const SURVEY_TASKS: ReadonlyArray<string> = [
  'are trees (instances of tree)',
  'have hold the position of Pope and are female',
  'are lakes of countries that have south America as continent',
  'are mountains of Europe',
  'were born in Argentina and are female',
  'are sub class of diseases or sub class of a sub class of disease (and so on)',
  'are films and are based on comics',
  'are sovereign states that shares border with territory of France',
  'were emperors with children who were also emperors',
  'are lakes of Chile with a vertical depth greater than 500',
];

@Component({
  selector: 'app-tasks-step',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div id="tasks">
      <h5>
        In <a [href]="currentUrl()" target="_blank">{{ currentUrl() }}</a>, find resources that
        <label [for]="'sparql' + taskIndex()" style="font-size: 1.5rem;">{{ taskText() }}</label>
      </h5>
      <form>
        <textarea class="form-control mb-2" [id]="'sparql' + taskIndex()" rows="5"
          placeholder="Your SPARQL query here."
          [ngModel]="sparql()"
          (ngModelChange)="sparqlChange.emit($event)"
          name="sparqlInput"></textarea>
        <div class="form-group row">
          <div class="col-sm-12">
            <button class="btn btn-primary pull-right" type="submit" (click)="advance.emit()">Next</button>
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
    .form-control { display: block; width: 100%; padding: 0.375rem 0.75rem; font-size: 1rem; line-height: 1.5; color: #495057; background-color: #fff; border: 1px solid #ced4da; border-radius: 0.25rem; }
    .mb-2 { margin-bottom: 0.5rem; }
    .row { display: flex; flex-wrap: wrap; margin-right: -15px; margin-left: -15px; }
    .col-sm-12 { flex: 0 0 100%; max-width: 100%; padding-right: 15px; padding-left: 15px; }
    a { color: #007bff; text-decoration: none; }
    a:hover { text-decoration: underline; }
  `]
})
export class TasksStepComponent {
  readonly taskIndex = input.required<number>();
  readonly taskText = input.required<string>();
  readonly currentUrl = input.required<string>();
  readonly sparql = input.required<string | null>();
  readonly sparqlChange = output<string | null>();
  readonly advance = output<void>();
}
