// Load native-sensitive operational routes only. Never invokes a route, DB or provider.
import {authRoutes} from '../../apps/server/src/routes/auth.ts';
import {tableRoutes} from '../../apps/server/src/routes/tables.ts';
import {menuRoutes} from '../../apps/server/src/routes/menu.ts';
import {menuWorkspaceRoutes} from '../../apps/server/src/routes/menu-workspace.ts';
import {uploadRoutes} from '../../apps/server/src/routes/uploads.ts';
if([authRoutes,tableRoutes,menuRoutes,menuWorkspaceRoutes,uploadRoutes].some(fn=>typeof fn!=='function'))throw Error('Missing route export');
console.log('Native-sensitive route module imports: PASS. No route invocation or backend parity claim.');
