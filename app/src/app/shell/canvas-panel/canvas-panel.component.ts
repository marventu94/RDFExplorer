import { Component, inject } from '@angular/core';
import { CanvasGraphComponent } from '../../graph/canvas-graph/canvas-graph.component';
import { PropertyGraphService } from '../../graph/property-graph.service';

@Component({
  selector: 'app-canvas-panel',
  imports: [CanvasGraphComponent],
  templateUrl: './canvas-panel.component.html',
  styleUrl: './canvas-panel.component.scss'
})
export class CanvasPanelComponent {
  private readonly graph: PropertyGraphService = inject(PropertyGraphService);

  testCats(): void {
    this.graph.applyDrop({ kind: 'example', exampleType: 'cats' }, { x: 200, y: 200 });
  }
}
