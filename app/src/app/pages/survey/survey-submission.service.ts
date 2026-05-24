import { Injectable } from '@angular/core';
import type { SurveyData } from './survey.types';

@Injectable({ providedIn: 'root' })
export class SurveySubmissionService {
  readonly #base = '';

  async submit(data: SurveyData): Promise<void> {
    const res = await fetch(`${this.#base}/upload-survey`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new Error(`Survey upload failed: ${res.status} ${res.statusText}`);
    }
  }

  download(data: SurveyData): void {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'answers.json';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }
}
