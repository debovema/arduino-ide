import { shell } from 'electron';
import { inject, injectable } from 'inversify';
import { CommandRegistry } from '@theia/core/lib/common/command';
import { MenuModelRegistry } from '@theia/core/lib/common/menu';
import { PreferenceService } from '@theia/core/lib/browser/preferences/preference-service';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application';
import { MainMenuManager } from '../../../common/main-menu-manager';
import { ArduinoPreferences } from '../../arduino-preferences';
import { SketchbookWidget } from './sketchbook-widget';
import { PlaceholderMenuNode } from '../../menu/arduino-menus';
import { SketchbookTree } from './sketchbook-tree';
import { SketchbookCommands } from './sketchbook-commands';
import { WorkspaceService } from '../../theia/workspace/workspace-service';
import { ContextMenuRenderer, RenderContextMenuOptions } from '@theia/core/lib/browser';
import { Disposable, DisposableCollection } from '@theia/core/lib/common/disposable';
import { SketchesServiceClientImpl } from '../../../common/protocol/sketches-service-client-impl';


export const SKETCHBOOK__CONTEXT = ['arduino-sketchbook--context'];

// `Open Folder`, `Open in New Window`
export const SKETCHBOOK__CONTEXT__MAIN_GROUP = [...SKETCHBOOK__CONTEXT, '0_main'];

@injectable()
export class SketchbookWidgetContribution extends AbstractViewContribution<SketchbookWidget> implements FrontendApplicationContribution {

    @inject(ArduinoPreferences)
    protected readonly arduinoPreferences: ArduinoPreferences;

    @inject(PreferenceService)
    protected readonly preferenceService: PreferenceService;

    @inject(MainMenuManager)
    protected readonly mainMenuManager: MainMenuManager;

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    @inject(MenuModelRegistry)
    protected readonly menuRegistry: MenuModelRegistry;

    @inject(SketchesServiceClientImpl)
    protected readonly sketchServiceClient: SketchesServiceClientImpl;

    @inject(ContextMenuRenderer)
    protected readonly contextMenuRenderer: ContextMenuRenderer;

    protected readonly toDisposeBeforeNewContextMenu = new DisposableCollection();

    constructor() {
        super({
            widgetId: 'arduino-sketchbook-widget',
            widgetName: 'Sketchbook',
            defaultWidgetOptions: {
                area: 'left',
                rank: 1
            },
            toggleCommandId: 'arduino-sketchbook-widget:toggle',
            toggleKeybinding: 'CtrlCmd+Shift+B'
        });
    }

    onStart(): void {
        this.arduinoPreferences.onPreferenceChanged(({ preferenceName }) => {
            if (preferenceName === 'arduino.sketchbook.showAllFiles') {
                this.mainMenuManager.update();
            }
        });
    }

    async initializeLayout(): Promise<void> {
        return this.openView() as Promise<any>;
    }

    registerCommands(registry: CommandRegistry): void {
        super.registerCommands(registry);

        registry.registerCommand(SketchbookCommands.OPEN_NEW_WINDOW, {
            execute: arg => this.workspaceService.open(arg.node.uri),
            isEnabled: arg => !!arg && 'node' in arg && SketchbookTree.SketchDirNode.is(arg.node),
            isVisible: arg => !!arg && 'node' in arg && SketchbookTree.SketchDirNode.is(arg.node)
        });

        registry.registerCommand(SketchbookCommands.REVEAL_IN_FINDER, {
            execute: (arg) => {
                shell.openPath(arg.node.id);
            },
            isEnabled: (arg) => !!arg && 'node' in arg && SketchbookTree.SketchDirNode.is(arg.node),
            isVisible: (arg) => !!arg && 'node' in arg && SketchbookTree.SketchDirNode.is(arg.node),
        });


        registry.registerCommand(SketchbookCommands.OPEN_SKETCHBOOK_CONTEXT_MENU, {
            isEnabled: (arg) => !!arg && 'node' in arg && SketchbookTree.SketchDirNode.is(arg.node),
            isVisible: (arg) => !!arg && 'node' in arg && SketchbookTree.SketchDirNode.is(arg.node),
            execute: async (arg) => {
                // cleanup previous context menu entries
                this.toDisposeBeforeNewContextMenu.dispose();
                const container = arg.event.target;
                if (!container) {
                    return;
                }

                // disable the "open sketch" command for the current sketch.
                // otherwise make the command clickable
                const currentSketch = await this.sketchServiceClient.currentSketch();
                if (currentSketch && currentSketch.uri === arg.node.uri.toString()) {
                    const placeholder = new PlaceholderMenuNode(SKETCHBOOK__CONTEXT__MAIN_GROUP, SketchbookCommands.OPEN_NEW_WINDOW.label!);
                    this.menuRegistry.registerMenuNode(SKETCHBOOK__CONTEXT__MAIN_GROUP, placeholder);
                    this.toDisposeBeforeNewContextMenu.push(Disposable.create(() => this.menuRegistry.unregisterMenuNode(placeholder.id)));
                } else {
                    this.menuRegistry.registerMenuAction(SKETCHBOOK__CONTEXT__MAIN_GROUP, {
                        commandId: SketchbookCommands.OPEN_NEW_WINDOW.id,
                        label: SketchbookCommands.OPEN_NEW_WINDOW.label,
                    });
                    this.toDisposeBeforeNewContextMenu.push(Disposable.create(() => this.menuRegistry.unregisterMenuAction(SketchbookCommands.OPEN_NEW_WINDOW)));
                }


                const options: RenderContextMenuOptions = {
                    menuPath: SKETCHBOOK__CONTEXT,
                    anchor: {
                        x: container.getBoundingClientRect().left,
                        y: container.getBoundingClientRect().top + container.offsetHeight
                    },
                    args: arg
                }
                this.contextMenuRenderer.render(options);
            }
        });
    }

    registerMenus(registry: MenuModelRegistry): void {
        super.registerMenus(registry);

        registry.registerMenuAction(SKETCHBOOK__CONTEXT__MAIN_GROUP, {
            commandId: SketchbookCommands.REVEAL_IN_FINDER.id,
            label: SketchbookCommands.REVEAL_IN_FINDER.label,
            order: '0'
        });

    }

}
