import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-demographics-step',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div id="user-id">
      <form>
        <fieldset class="form-group">
          <div class="row">
            <legend class="col-form-label col-sm-2 pt-0">Gender:</legend>
            <div class="col-sm-10">
              <div class="form-check">
                <input class="form-check-input" id="gender-male" type="radio" name="gender" value="male"
                  [ngModel]="gender()" (ngModelChange)="genderChange.emit($event)" />
                <label class="form-check-label" for="gender-male">Male</label>
              </div>
              <div class="form-check">
                <input class="form-check-input" id="gender-female" type="radio" name="gender" value="female"
                  [ngModel]="gender()" (ngModelChange)="genderChange.emit($event)" />
                <label class="form-check-label" for="gender-female">Female</label>
              </div>
            </div>
          </div>
        </fieldset>
        <div class="form-group row">
          <label class="col-sm-2 col-form-label" for="user-age">Age:</label>
          <div class="col-sm-10">
            <input class="form-control" id="user-age" type="number" placeholder="18"
              [ngModel]="age()" (ngModelChange)="ageChange.emit($event)" />
          </div>
        </div>
        <div class="form-group row">
          <label class="col-sm-2 col-form-label" for="user-degree">Degree/Career:</label>
          <div class="col-sm-10">
            <input class="form-control" id="user-degree" type="text" placeholder="Phd, Engineer..."
              [ngModel]="degree()" (ngModelChange)="degreeChange.emit($event)" />
          </div>
        </div>
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
    .form-check { position: relative; display: block; padding-left: 1.25rem; }
    .form-check-input { position: absolute; margin-left: -1.25rem; margin-top: 0.3rem; }
    .form-check-label { margin-bottom: 0; }
    .form-control { display: block; width: 100%; padding: 0.375rem 0.75rem; font-size: 1rem; line-height: 1.5; color: #495057; background-color: #fff; border: 1px solid #ced4da; border-radius: 0.25rem; }
    .col-form-label { padding-top: calc(0.375rem + 1px); padding-bottom: calc(0.375rem + 1px); margin-bottom: 0; font-size: inherit; line-height: 1.5; }
    .row { display: flex; flex-wrap: wrap; margin-right: -15px; margin-left: -15px; }
    .col-sm-2 { flex: 0 0 16.666667%; max-width: 16.666667%; padding-right: 15px; padding-left: 15px; }
    .col-sm-10 { flex: 0 0 83.333333%; max-width: 83.333333%; padding-right: 15px; padding-left: 15px; }
    .col-sm-12 { flex: 0 0 100%; max-width: 100%; padding-right: 15px; padding-left: 15px; }
    .pt-0 { padding-top: 0 !important; }
  `]
})
export class DemographicsStepComponent {
  readonly gender = input.required<string>();
  readonly genderChange = output<string>();
  readonly age = input.required<number | null>();
  readonly ageChange = output<number | null>();
  readonly degree = input.required<string | null>();
  readonly degreeChange = output<string | null>();
  readonly advance = output<void>();
}
