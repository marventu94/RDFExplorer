import { Component, inject, signal } from '@angular/core';
import { LogService } from '../../core/log.service';
import { FAQ_ENTRIES } from './faq.data';

@Component({
  selector: 'app-help-panel',
  templateUrl: './help-panel.component.html',
  styleUrl: './help-panel.component.scss',
  standalone: true,
})
export class HelpPanelComponent {
  readonly log = inject(LogService);

  faqEntries = FAQ_ENTRIES;
  expandedFaq: boolean[] = [];

  isExpanded(index: number): boolean {
    return this.expandedFaq[index] ?? false;
  }

  toggleFaq(index: number): void {
    this.expandedFaq[index] = !(this.expandedFaq[index] ?? false);
  }

  onDragExample(event: DragEvent, type: string): void {
    event.dataTransfer?.setData('special', 'example');
    event.dataTransfer?.setData('type', type);
  }

  onTutorial(): void {
    this.log.add('TODO: interactive tutorial (Stage 5)');
  }

  onModalHelp(): void {
    this.log.add('TODO: getting started modal (Stage 5)');
  }
}
