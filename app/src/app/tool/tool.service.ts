import { Injectable, signal } from '@angular/core';

export type ToolName = 'describe' | 'edit' | 'sparql' | 'settings' | 'log' | 'help';

@Injectable({ providedIn: 'root' })
export class ToolService {
  readonly active = signal<ToolName | 'none'>('none');

  toggle(name: ToolName): void {
    this.active.update(current => current === name ? 'none' : name);
  }
}
