import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { ProjectScanner } from '../../src/core/ProjectScanner';
import { NodeType, RelationType } from '../../src/graph/GraphNode';

describe('ProjectScanner relationship analysis', () => {
  let projectPath: string | undefined;

  afterEach(async () => {
    if (projectPath) {
      await fs.rm(projectPath, { recursive: true, force: true });
      projectPath = undefined;
    }
  });

  it('resolves aliased calls to exported functions across files', async () => {
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'project-doctor-'));
    const entryPath = path.join(projectPath, 'entry.ts');
    const workerPath = path.join(projectPath, 'worker.ts');

    await fs.writeFile(entryPath, "import { doWork as runWork } from './worker';\nexport function run() { runWork(); }\n");
    await fs.writeFile(workerPath, 'export function doWork() {}\n');

    const result = await new ProjectScanner().scan(projectPath);
    const relationships = result.relationshipGraph.getRelationships(`${entryPath}#run`, RelationType.CALLS);

    expect(relationships).toHaveLength(1);
    expect(relationships[0].target).toBe(`${workerPath}#doWork`);
    expect(JSON.stringify(result.toJSON())).toContain('CALLS');
  });

  it('resolves default imports through re-exports and tsconfig path aliases', async () => {
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'project-doctor-'));
    const sourceDirectory = path.join(projectPath, 'src');
    await fs.mkdir(sourceDirectory);
    const entryPath = path.join(sourceDirectory, 'entry.ts');
    const barrelPath = path.join(sourceDirectory, 'barrel.ts');
    const workerPath = path.join(sourceDirectory, 'worker.ts');

    await fs.writeFile(path.join(projectPath, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        baseUrl: '.',
        paths: { '@app/*': ['src/*'] }
      }
    }));
    await fs.writeFile(entryPath, "import runWork from '@app/barrel';\nexport function run() { runWork(); }\n");
    await fs.writeFile(barrelPath, "export { default } from './worker';\n");
    await fs.writeFile(workerPath, 'export default function doWork() {}\n');

    const result = await new ProjectScanner().scan(projectPath);
    const relationships = result.relationshipGraph.getRelationships(`${entryPath}#run`, RelationType.CALLS);

    expect(relationships).toHaveLength(1);
    expect(relationships[0].target).toBe(`${workerPath}#doWork`);
  });

  it('tracks calls between methods on the same class', async () => {
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'project-doctor-'));
    const workerPath = path.join(projectPath, 'worker.ts');
    await fs.writeFile(workerPath, [
      'export class Worker {',
      '  run() { this.execute(); }',
      '  execute() {}',
      '}'
    ].join('\n'));

    const result = await new ProjectScanner().scan(projectPath);
    const relationships = result.relationshipGraph.getRelationships(`${workerPath}#Worker.run`, RelationType.CALLS);

    expect(relationships).toHaveLength(1);
    expect(relationships[0].target).toBe(`${workerPath}#Worker.execute`);
  });

  it('tracks named callback arguments and JSX event handlers', async () => {
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'project-doctor-'));
    const uiPath = path.join(projectPath, 'ui.tsx');
    await fs.writeFile(uiPath, [
      'function onDone() {}',
      'function handleClick() {}',
      'export function run() { setTimeout(onDone, 0); }',
      'export function Button() { return <button onClick={handleClick} />; }'
    ].join('\n'));

    const result = await new ProjectScanner().scan(projectPath);
    const callbacks = result.relationshipGraph.getRelationships(`${uiPath}#run`, RelationType.CALLBACK);
    const handlers = result.relationshipGraph.getRelationships(`${uiPath}#Button`, RelationType.HANDLES);

    expect(callbacks.map(edge => edge.target)).toContain(`${uiPath}#onDone`);
    expect(handlers.map(edge => edge.target)).toContain(`${uiPath}#handleClick`);
  });

  it('tracks class decorators, mixins, and interface implementations', async () => {
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'project-doctor-'));
    const sourcePath = path.join(projectPath, 'classes.ts');
    await fs.writeFile(sourcePath, [
      'function sealed(target: unknown) {}',
      'function WithMixin(base: unknown) { return base; }',
      'interface Contract {}',
      'class Base {}',
      '@sealed',
      'export class Child extends WithMixin(Base) implements Contract {}'
    ].join('\n'));

    const result = await new ProjectScanner().scan(projectPath);
    const sourceId = `${sourcePath}#Child`;

    expect(result.relationshipGraph.getRelationships(sourceId, RelationType.DECORATES).map(edge => edge.target))
      .toContain(`${sourcePath}#sealed`);
    expect(result.relationshipGraph.getRelationships(sourceId, RelationType.USES).map(edge => edge.target))
      .toContain(`${sourcePath}#WithMixin`);
    expect(result.relationshipGraph.getRelationships(sourceId, RelationType.IMPLEMENTS).map(edge => edge.target))
      .toContain(`${sourcePath}#Contract`);
  });

  it('maps JSX component composition and props', async () => {
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'project-doctor-'));
    const componentPath = path.join(projectPath, 'ui.tsx');
    await fs.writeFile(componentPath, [
      'export function Button({ label }: { label: string }) {',
      '  return <button>{label}</button>;',
      '}',
      '',
      'export function Card() {',
      '  return <Button label="Submit" />;',
      '}'
    ].join('\n'));

    const result = await new ProjectScanner().scan(projectPath);
    const cardId = `${componentPath}#Card`;
    const buttonId = `${componentPath}#Button`;

    expect(result.relationshipGraph.getRelationships(cardId, RelationType.USES).map(edge => edge.target)).toContain(buttonId);
    expect(result.relationshipGraph.getNode(buttonId)?.type).toBe(NodeType.COMPONENT);
    expect(result.relationshipGraph.getNode(buttonId)?.metadata?.props).toEqual(['label']);
  });

  it('maps service classes to injected repositories and collaborators', async () => {
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'project-doctor-'));
    const repositoryPath = path.join(projectPath, 'repository.ts');
    const servicePath = path.join(projectPath, 'service.ts');

    await fs.writeFile(repositoryPath, [
      'export class UserRepository {}',
      'export class AuditLogger {}'
    ].join('\n'));
    await fs.writeFile(servicePath, [
      "import { UserRepository, AuditLogger } from './repository';",
      'export class UserService {',
      '  constructor(private repository: UserRepository, private logger: AuditLogger) {}',
      '  get() { return this.repository; }',
      '}'
    ].join('\n'));

    const result = await new ProjectScanner().scan(projectPath);
    const serviceId = `${servicePath}#UserService`;
    const repositoryId = `${repositoryPath}#UserRepository`;
    const loggerId = `${repositoryPath}#AuditLogger`;

    expect(result.relationshipGraph.getNode(serviceId)?.type).toBe(NodeType.SERVICE);
    expect(result.relationshipGraph.getRelationships(serviceId, RelationType.USES).map(edge => edge.target)).toEqual(
      expect.arrayContaining([repositoryId, loggerId])
    );
  });

  it('maps Laravel request flow from routes to controller and service dependencies', async () => {
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'project-doctor-'));
    const routesDirectory = path.join(projectPath, 'routes');
    const controllerDirectory = path.join(projectPath, 'app', 'Http', 'Controllers');
    const serviceDirectory = path.join(projectPath, 'app', 'Services');
    const repositoryDirectory = path.join(projectPath, 'app', 'Repositories');
    await fs.mkdir(routesDirectory, { recursive: true });
    await fs.mkdir(controllerDirectory, { recursive: true });
    await fs.mkdir(serviceDirectory, { recursive: true });
    await fs.mkdir(repositoryDirectory, { recursive: true });

    const routesPath = path.join(routesDirectory, 'web.php');
    const controllerPath = path.join(controllerDirectory, 'UserController.php');
    const servicePath = path.join(serviceDirectory, 'UserService.ts');
    const repositoryPath = path.join(repositoryDirectory, 'UserRepository.ts');

    await fs.writeFile(routesPath, [
      '<?php',
      'use App\\Http\\Controllers\\UserController;',
      "Route::get('/users', [UserController::class, 'index']);"
    ].join('\n'));
    await fs.writeFile(controllerPath, [
      '<?php',
      'namespace App\\Http\\Controllers;',
      'class UserController {',
      '  public function __construct(private UserService $service) {}',
      '  public function index() { return $this->service->list(); }',
      '}'
    ].join('\n'));
    await fs.writeFile(servicePath, [
      'export class UserService {',
      '  constructor(private repository: UserRepository) {}',
      '  list() { return this.repository; }',
      '}'
    ].join('\n'));
    await fs.writeFile(repositoryPath, 'export class UserRepository {}');

    const result = await new ProjectScanner().scan(projectPath);
    const routeId = `${routesPath}#route:GET:/users:3`;
    const controllerId = 'php-controller:App\\Http\\Controllers\\UserController';
    const serviceId = `${servicePath}#UserService`;
    const repositoryId = `${repositoryPath}#UserRepository`;

    expect(result.relationshipGraph.getRelationships(routeId, RelationType.MAPS_TO)[0].target).toBe(controllerId);
    expect(result.relationshipGraph.getRelationships(controllerId, RelationType.USES).map(edge => edge.target)).toContain(serviceId);
    expect(result.relationshipGraph.getRelationships(serviceId, RelationType.USES).map(edge => edge.target)).toContain(repositoryId);
  });

  it('maps Laravel web routes to controller actions', async () => {
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'project-doctor-'));
    const routesDirectory = path.join(projectPath, 'routes');
    const controllerDirectory = path.join(projectPath, 'app', 'Http', 'Controllers');
    await fs.mkdir(routesDirectory);
    await fs.mkdir(controllerDirectory, { recursive: true });
    const routesPath = path.join(routesDirectory, 'web.php');
    const apiRoutesPath = path.join(routesDirectory, 'api.php');
    const controllerPath = path.join(controllerDirectory, 'UserController.php');
    await fs.writeFile(routesPath, [
      '<?php',
      'use App\\Http\\Controllers\\UserController;',
      "Route::get('/users', [UserController::class, 'index']);",
      "Route::apiResource('/posts', UserController::class);",
      "Route::get('/legacy', 'UserController@show');"
    ].join('\n'));
    await fs.writeFile(apiRoutesPath, [
      '<?php',
      'use App\\Http\\Controllers\\UserController;',
      "Route::match(['get', 'post'], '/users/{user}', [UserController::class, 'show']);"
    ].join('\n'));
    await fs.writeFile(controllerPath, [
      '<?php',
      'namespace App\\Http\\Controllers;',
      'class UserController {',
      '  public function index() {}',
      '  public function show(int $id) {}',
      '  protected function helper() {}',
      '}'
    ].join('\n'));

    const result = await new ProjectScanner().scan(projectPath);
    const controllerId = 'php-controller:App\\Http\\Controllers\\UserController';
    const routeId = `${routesPath}#route:GET:/users:3`;
    const routeNode = result.relationshipGraph.getNode(routeId);
    const mappings = result.relationshipGraph.getRelationships(routeId, RelationType.MAPS_TO);

    expect(routeNode?.type).toBe(NodeType.API_ROUTE);
    expect(mappings).toHaveLength(1);
    expect(mappings[0].target).toBe(controllerId);
    expect(mappings[0].metadata?.action).toBe('index');
    const indexAction = result.relationshipGraph.getRelationships(routeId, RelationType.HANDLES);
    expect(indexAction[0].target).toBe(`${controllerId}#action:index`);

    const resourceRoute = result.relationshipGraph.getRelationships(`${routesPath}#route:APIRESOURCE:/posts:4`, RelationType.MAPS_TO);
    expect(resourceRoute[0].target).toBe(controllerId);
    expect(resourceRoute[0].metadata?.action).toBe('resource');

    const stringAction = result.relationshipGraph.getRelationships(`${routesPath}#route:GET:/legacy:5`, RelationType.MAPS_TO);
    expect(stringAction[0].target).toBe(controllerId);
    expect(stringAction[0].metadata?.action).toBe('show');

    const matchedApiRoute = result.relationshipGraph.getRelationships(`${apiRoutesPath}#route:GET|POST:/users/{user}:3`, RelationType.MAPS_TO);
    expect(matchedApiRoute[0].target).toBe(controllerId);
    expect(matchedApiRoute[0].metadata?.action).toBe('show');
    const showAction = result.relationshipGraph.getRelationships(`${apiRoutesPath}#route:GET|POST:/users/{user}:3`, RelationType.HANDLES);
    expect(showAction[0].target).toBe(`${controllerId}#action:show`);
    expect(result.relationshipGraph.getNode(`${controllerId}#action:show`)?.metadata?.parameters).toEqual(['id']);
    expect(result.relationshipGraph.getNode(`${controllerId}#action:helper`)).toBeUndefined();
  });

  it('stores Laravel route names and namespaced controller metadata', async () => {
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'project-doctor-'));
    const routesDirectory = path.join(projectPath, 'routes');
    const controllerDirectory = path.join(projectPath, 'app', 'Http', 'Controllers');
    await fs.mkdir(routesDirectory);
    await fs.mkdir(controllerDirectory, { recursive: true });
    const routesPath = path.join(routesDirectory, 'web.php');
    const controllerPath = path.join(controllerDirectory, 'AdminUserController.php');

    await fs.writeFile(routesPath, [
      '<?php',
      "Route::name('admin.')->namespace('App\\Http\\Controllers\\Admin')->group(function () {",
      "  Route::get('/dashboard', 'UserController@index')->name('dashboard');",
      '});'
    ].join('\n'));
    await fs.writeFile(controllerPath, [
      '<?php',
      'namespace App\\Http\\Controllers\\Admin;',
      'class UserController {',
      '  public function index() {}',
      '}'
    ].join('\n'));

    const result = await new ProjectScanner().scan(projectPath);
    const routeId = `${routesPath}#route:GET:/dashboard:3`;
    const routeNode = result.relationshipGraph.getNode(routeId);

    expect(routeNode?.metadata?.name).toBe('admin.dashboard');
    expect(routeNode?.metadata?.controller).toBe('App\\Http\\Controllers\\Admin\\UserController');
    expect(routeNode?.metadata?.action).toBe('index');
  });

  it('applies route group prefixes and controller defaults', async () => {
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'project-doctor-'));
    const routesDirectory = path.join(projectPath, 'routes');
    await fs.mkdir(routesDirectory);
    const routesPath = path.join(routesDirectory, 'web.php');
    const apiRoutesPath = path.join(routesDirectory, 'api.php');
    await fs.writeFile(routesPath, [
      '<?php',
      "Route::prefix('admin')->controller(UserController::class)->group(function () {",
      "  Route::get('/dashboard', 'index');",
      '});'
    ].join('\n'));
    await fs.writeFile(apiRoutesPath, [
      '<?php',
      "Route::group(['prefix' => 'v2', 'controller' => UserController::class], function () {",
      "  Route::post('/dashboard', 'store');",
      '});'
    ].join('\n'));

    const result = await new ProjectScanner().scan(projectPath);
    const routeId = `${routesPath}#route:GET:/admin/dashboard:3`;
    const mappings = result.relationshipGraph.getRelationships(routeId, RelationType.MAPS_TO);

    expect(mappings).toHaveLength(1);
    expect(mappings[0].target).toBe('php-controller:UserController');
    expect(mappings[0].metadata?.action).toBe('index');

    const optionRouteId = `${apiRoutesPath}#route:POST:/v2/dashboard:3`;
    const optionMappings = result.relationshipGraph.getRelationships(optionRouteId, RelationType.MAPS_TO);
    expect(optionMappings).toHaveLength(1);
    expect(optionMappings[0].target).toBe('php-controller:UserController');
    expect(optionMappings[0].metadata?.action).toBe('store');
  });

  it('maps middleware declared by Laravel controllers', async () => {
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'project-doctor-'));
    const controllerDirectory = path.join(projectPath, 'app', 'Http', 'Controllers');
    await fs.mkdir(controllerDirectory, { recursive: true });
    const controllerPath = path.join(controllerDirectory, 'UserController.php');

    await fs.writeFile(controllerPath, [
      '<?php',
      'namespace App\\Http\\Controllers;',
      'class UserController {',
      '  public function __construct() {',
      "    $this->middleware('auth');",
      "    $this->middleware(['verified', 'throttle:60,1']);",
      '  }',
      '  public function index() {}',
      '}'
    ].join('\n'));

    const result = await new ProjectScanner().scan(projectPath);
    const controllerId = 'php-controller:App\\Http\\Controllers\\UserController';
    const middlewareEdges = result.relationshipGraph.getRelationships(controllerId, RelationType.USES);

    expect(middlewareEdges.map(edge => edge.target)).toEqual(
      expect.arrayContaining([
        'php-middleware:auth',
        'php-middleware:verified',
        'php-middleware:throttle:60,1'
      ])
    );
  });

  it('maps Eloquent model lifecycle events', async () => {
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'project-doctor-'));
    const modelDirectory = path.join(projectPath, 'app', 'Models');
    await fs.mkdir(modelDirectory, { recursive: true });
    const modelPath = path.join(modelDirectory, 'User.php');

    await fs.writeFile(modelPath, [
      '<?php',
      'namespace App\\Models;',
      'use Illuminate\\Database\\Eloquent\\Model;',
      'class User extends Model {',
      '  protected static function booted() {',
      "    static::creating(function ($user) {});",
      "    static::updated(function ($user) {});",
      '  }',
      '}'
    ].join('\n'));

    const result = await new ProjectScanner().scan(projectPath);
    const modelId = 'php-model:App\\Models\\User';
    const eventEdges = result.relationshipGraph.getRelationships(modelId, RelationType.USES);

    expect(eventEdges.map(edge => edge.target)).toEqual(
      expect.arrayContaining([
        `${modelId}#event:creating`,
        `${modelId}#event:updated`
      ])
    );
  });
});
