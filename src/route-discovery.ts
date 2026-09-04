import { readdir, readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, normalize, resolve } from 'node:path';
import ts from 'typescript';
import type { AngularRouteDiscoveryOptions } from './types.js';

interface ParsedRouteFile {
  path: string;
  sourceFile: ts.SourceFile;
  arrays: Map<string, ts.ArrayLiteralExpression>;
  imports: Map<string, { specifier: string; exportName: string }>;
  roots: ts.Expression[];
}

/** Discovers static Angular Router URLs starting at provideRouter/forRoot. */
export async function discoverAngularRoutes(
  projectDirectory = process.cwd(),
  options: AngularRouteDiscoveryOptions = {},
): Promise<string[]> {
  const sourceRoot = resolve(projectDirectory, options.root ?? 'src');
  const paths = await findTypeScriptFiles(sourceRoot);
  const files = new Map<string, ParsedRouteFile>();

  await Promise.all(
    paths.map(async (path) => {
      const parsed = parseRouteFile(path, await readFile(path, 'utf8'));
      files.set(normalize(path), parsed);
    }),
  );

  const roots = [...files.values()].flatMap((file) =>
    file.roots.map((expression) => ({ file, expression })),
  );

  // Some applications export an app.routes.ts array and bootstrap elsewhere.
  if (roots.length === 0) {
    for (const file of files.values()) {
      if (!/(^|[\\/])app\.routes\.ts$/i.test(file.path)) continue;
      const preferred = file.arrays.get('routes') ?? file.arrays.get('appRoutes');
      if (preferred) roots.push({ file, expression: preferred });
    }
  }

  const discovered = new Set<string>();
  for (const root of roots) {
    collectRoutes(root.file, root.expression, '', files, discovered, new Set());
  }

  return [...discovered].sort((a, b) => {
    if (a === '/') return -1;
    if (b === '/') return 1;
    return a.localeCompare(b);
  });
}

async function findTypeScriptFiles(directory: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }

  const nested = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith('.') && entry.name !== 'node_modules')
      .map(async (entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return findTypeScriptFiles(path);
        if (
          entry.isFile() &&
          entry.name.endsWith('.ts') &&
          !entry.name.endsWith('.d.ts') &&
          !/\.(spec|test)\.ts$/i.test(entry.name)
        ) {
          return [path];
        }
        return [];
      }),
  );
  return nested.flat();
}

function parseRouteFile(path: string, source: string): ParsedRouteFile {
  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const arrays = new Map<string, ts.ArrayLiteralExpression>();
  const imports = new Map<string, { specifier: string; exportName: string }>();
  const roots: ts.Expression[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.importClause
    ) {
      const specifier = node.moduleSpecifier.text;
      if (node.importClause.name) {
        imports.set(node.importClause.name.text, { specifier, exportName: 'default' });
      }
      const bindings = node.importClause.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const binding of bindings.elements) {
          imports.set(binding.name.text, {
            specifier,
            exportName: binding.propertyName?.text ?? binding.name.text,
          });
        }
      }
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const array = unwrapArray(node.initializer);
      if (array) arrays.set(node.name.text, array);
    }
    if (ts.isExportAssignment(node)) {
      const array = unwrapArray(node.expression);
      if (array) arrays.set('default', array);
    }
    if (ts.isCallExpression(node)) {
      const name = callName(node.expression);
      if ((name === 'provideRouter' || name === 'forRoot') && node.arguments[0]) {
        roots.push(node.arguments[0]);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return { path, sourceFile, arrays, imports, roots };
}

function collectRoutes(
  file: ParsedRouteFile,
  expression: ts.Expression,
  parentPath: string,
  files: Map<string, ParsedRouteFile>,
  output: Set<string>,
  visiting: Set<string>,
): void {
  const array = resolveArray(file, expression, files);
  if (!array) return;

  const visitKey = `${file.path}:${array.pos}:${parentPath}`;
  if (visiting.has(visitKey)) return;
  visiting.add(visitKey);

  for (const element of array.elements) {
    if (!ts.isObjectLiteralExpression(element)) continue;
    const path = stringProperty(element, 'path');
    if (path === undefined) continue;

    const fullPath = joinRoutePath(parentPath, path);
    const redirect = property(element, 'redirectTo');
    const isConcrete =
      !redirect &&
      !fullPath.split('/').some((segment) => segment === '**' || segment.startsWith(':'));
    const children = property(element, 'children');
    const lazy = property(element, 'loadChildren');

    if (isConcrete && hasPageTarget(element)) output.add(fullPath);
    if (children) collectRoutes(file, children.initializer, fullPath, files, output, visiting);
    if (lazy) {
      const target = lazyTarget(file, lazy.initializer, files);
      if (target) {
        collectRoutes(target.file, target.expression, fullPath, files, output, visiting);
      }
    }
  }

  visiting.delete(visitKey);
}

function resolveArray(
  file: ParsedRouteFile,
  expression: ts.Expression | undefined,
  files: Map<string, ParsedRouteFile>,
): ts.ArrayLiteralExpression | undefined {
  const direct = unwrapArray(expression);
  if (direct) return direct;
  const value = unwrapExpression(expression);
  if (!value || !ts.isIdentifier(value)) return undefined;

  const local = file.arrays.get(value.text);
  if (local) return local;

  const imported = file.imports.get(value.text);
  if (!imported) return undefined;
  return resolveImportedFile(file.path, imported.specifier, files)?.arrays.get(
    imported.exportName,
  );
}

function unwrapArray(
  expression: ts.Expression | undefined,
): ts.ArrayLiteralExpression | undefined {
  const value = unwrapExpression(expression);
  return value && ts.isArrayLiteralExpression(value) ? value : undefined;
}

function unwrapExpression(expression: ts.Expression | undefined): ts.Expression | undefined {
  let value = expression;
  while (
    value &&
    (ts.isParenthesizedExpression(value) ||
      ts.isAsExpression(value) ||
      ts.isSatisfiesExpression(value))
  ) {
    value = value.expression;
  }
  return value;
}

function property(
  object: ts.ObjectLiteralExpression,
  name: string,
): ts.PropertyAssignment | undefined {
  return object.properties.find(
    (item): item is ts.PropertyAssignment =>
      ts.isPropertyAssignment(item) && propertyName(item.name) === name,
  );
}

function stringProperty(object: ts.ObjectLiteralExpression, name: string): string | undefined {
  const item = property(object, name);
  const value = unwrapExpression(item?.initializer);
  return value && (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))
    ? value.text
    : undefined;
}

function propertyName(name: ts.PropertyName): string | undefined {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : undefined;
}

function callName(expression: ts.LeftHandSideExpression): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text;
  return ts.isPropertyAccessExpression(expression) ? expression.name.text : undefined;
}

function hasPageTarget(route: ts.ObjectLiteralExpression): boolean {
  return ['component', 'loadComponent'].some((name) => Boolean(property(route, name)));
}

function joinRoutePath(parent: string, child: string): string {
  const parts = `${parent}/${child}`.split('/').filter(Boolean);
  return parts.length === 0 ? '/' : `/${parts.join('/')}`;
}

function lazyTarget(
  source: ParsedRouteFile,
  expression: ts.Expression,
  files: Map<string, ParsedRouteFile>,
): { file: ParsedRouteFile; expression: ts.Expression } | undefined {
  let importPath: string | undefined;
  let exportName: string | undefined;

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      importPath = node.arguments[0].text;
    }
    if (
      ts.isArrowFunction(node) &&
      ts.isPropertyAccessExpression(node.body)
    ) {
      exportName = node.body.name.text;
    }
    ts.forEachChild(node, visit);
  };
  visit(expression);
  if (!importPath) return undefined;

  const resolvedFile = resolveImportedFile(source.path, importPath, files);
  if (!resolvedFile) return undefined;
  const array = exportName
    ? resolvedFile.arrays.get(exportName)
    : resolvedFile.arrays.get('default');
  return array ? { file: resolvedFile, expression: array } : undefined;
}

function resolveImportedFile(
  importer: string,
  specifier: string,
  files: Map<string, ParsedRouteFile>,
): ParsedRouteFile | undefined {
  if (!specifier.startsWith('.') && !isAbsolute(specifier)) return undefined;
  const base = resolve(dirname(importer), specifier);
  const candidates = base.endsWith('.ts')
    ? [base]
    : base.endsWith('.js')
      ? [`${base.slice(0, -3)}.ts`]
      : [`${base}.ts`, join(base, 'index.ts')];
  return candidates.map(normalize).map((path) => files.get(path)).find(Boolean);
}
