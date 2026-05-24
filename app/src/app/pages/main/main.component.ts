import { Component } from '@angular/core';
import { SearchPanelComponent } from '../../shell/search-panel/search-panel.component';
import { CanvasPanelComponent } from '../../shell/canvas-panel/canvas-panel.component';
import { ToolsPanelComponent } from '../../shell/tools-panel/tools-panel.component';

@Component({
  selector: 'app-main',
  imports: [SearchPanelComponent, CanvasPanelComponent, ToolsPanelComponent],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent {}
