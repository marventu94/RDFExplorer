import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-consent-step',
  standalone: true,
  imports: [FormsModule],
  template: `
    <fieldset class="form-group">
      <p>
        In this user study you will be asked to evaluate two interfaces for the creation of SPARQL queries.
        The study is divided into 4 tasks. First you will be asked for basic identification information.
        Second, you will be asked to answer 10 questions by creating SPARQL queries with the interfaces to evaluate
        (switching between them in each question), in this section you should copy and paste the queries created by
        the interfaces and enter them in the text boxes provided.
        The last two tasks are subjective evaluations in which you must rate each interface based on your
        experience using them.
      </p>
      <b>It is important that you:</b>
      <p class="mt-2 ml-3">1.- Read carefully the questions and options presented to you.</p>
      <p class="ml-3">2.- Press 'next' only when you are sure, as you don't have the option to go back to previous questions.</p>
      <p class="ml-3">3.- Do not refresh the page at any time during the test.</p>

      <h5>Consent form</h5>
      <p>
        Your participation in this study is completely voluntary.
        All of your answers are confidential and anonymous.
        Your data is stored in electronic format and will be used for academic purposes only.
        If you have any questions, please contact Hernán Vargas at hernan.vargas&commat;alumnos.usm.cl.
      </p>
      <b>Clicking on the "accept and continue" button confirms that:</b>
      <p class="mt-2 ml-3">- You have read the above information.</p>
      <p class="ml-3">- You voluntarily agree to participate in the study.</p>
      <p class="ml-3">- You are at least 18 years old.</p>
      <b>If you agree, select the interface you will start with and press continue:</b>
      <div class="row mb-3 mt-3">
        <legend class="col-form-label col-sm-1 pt-0"></legend>
        <div class="col-sm-11">
          <div class="form-check">
            <input class="form-check-input" id="base-url" type="radio" name="gridRadios"
              [value]="'https://explorer.csrg.cl'" [ngModel]="startUrl()"
              (ngModelChange)="startUrlChange.emit($event)" />
            <label class="form-check-label" for="base-url">https://explorer.csrg.cl</label>
          </div>
          <div class="form-check">
            <input class="form-check-input" id="wqh-url" type="radio" name="gridRadios"
              [value]="'https://query.wikidata.org'" [ngModel]="startUrl()"
              (ngModelChange)="startUrlChange.emit($event)" />
            <label class="form-check-label" for="wqh-url">https://query.wikidata.org</label>
          </div>
        </div>
      </div>
      <div class="form-group row">
        <div class="col-sm-12">
          <button class="btn btn-primary pull-right mt-1" type="submit" (click)="advance.emit()">
            Accept and continue
          </button>
        </div>
      </div>
    </fieldset>
  `,
  styles: [`
    :host { display: contents; }
    .btn-primary { background-color: #007bff; border-color: #007bff; color: #fff; }
    .pull-right { float: right; }
    .ml-3 { margin-left: 1rem; }
    .mt-1 { margin-top: 0.25rem; }
    .mt-2 { margin-top: 0.5rem; }
    .mt-3 { margin-top: 1rem; }
    .mb-3 { margin-bottom: 1rem; }
    .form-group { margin-bottom: 1rem; }
    .form-check { position: relative; display: block; padding-left: 1.25rem; }
    .form-check-input { position: absolute; margin-left: -1.25rem; margin-top: 0.3rem; }
    .form-check-label { margin-bottom: 0; }
    .col-form-label { padding-top: calc(0.375rem + 1px); padding-bottom: calc(0.375rem + 1px); }
  `]
})
export class ConsentStepComponent {
  readonly startUrl = input.required<'https://explorer.csrg.cl' | 'https://query.wikidata.org'>();
  readonly startUrlChange = output<'https://explorer.csrg.cl' | 'https://query.wikidata.org'>();
  readonly advance = output<void>();
}
