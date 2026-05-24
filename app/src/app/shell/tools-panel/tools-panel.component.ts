import { Component, inject } from '@angular/core';
import { ToolService } from '../../tool/tool.service';

@Component({
  selector: 'app-tools-panel',
  templateUrl: './tools-panel.component.html',
  styleUrl: './tools-panel.component.scss'
})
export class ToolsPanelComponent {
  readonly toolService = inject(ToolService);
}
