import { Injectable, signal, inject, effect } from '@angular/core';
import { GraphInteractionService } from '../graph/canvas-graph/interaction.service';

export type ToolName = 'describe' | 'edit' | 'sparql' | 'settings' | 'log' | 'help';

@Injectable({ providedIn: 'root' })
export class ToolService {
  private readonly interaction = inject(GraphInteractionService);
  readonly active = signal<ToolName | 'none'>('none');

  constructor() {
    effect(() => {
      const req = this.interaction.requestedTool();
      if (req) this.active.set(req.tool);
    });
  }

  toggle(name: ToolName): void {
    this.active.update(current => current === name ? 'none' : name);
  }
}
