import { Component, output } from '@angular/core';

@Component({
  selector: 'app-completed-step',
  standalone: true,
  template: `
    <div id="completed">
      <h5>Your answers have been saved.</h5>
      <h5>Thanks for answering this survey!</h5>
      <button class="btn btn-primary pull-right" type="button" (click)="download.emit()">Download</button>
    </div>
  `,
  styles: [`
    :host { display: contents; }
    .btn-primary { background-color: #007bff; border-color: #007bff; color: #fff; padding: 0.375rem 0.75rem; font-size: 1rem; border-radius: 0.25rem; cursor: pointer; }
    .pull-right { float: right; }
  `]
})
export class CompletedStepComponent {
  readonly download = output<void>();
}
