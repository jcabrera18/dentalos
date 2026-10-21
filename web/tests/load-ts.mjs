// Carga TS/TSX para node:test usando TypeScript ya instalado, sin otro runner.
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cache = new Map()

export function loadTs(relativePath, dependencies = {}) {
  let filename = resolve(root, relativePath)
  if (!existsSync(filename)) filename = ['.ts', '.tsx'].map(ext => filename + ext).find(existsSync)
  if (!filename) throw new Error(`No se encontró ${relativePath}`)
  if (cache.has(filename)) return cache.get(filename)
  const nativeRequire = createRequire(filename)
  const compiledModule = { exports: {} }
  const localRequire = id => {
    if (id in dependencies) return dependencies[id]
    if (id.startsWith('@/')) return loadTs(id.slice(2), dependencies)
    if (id.startsWith('.')) return loadTs(resolve(dirname(filename), id), dependencies)
    return nativeRequire(id)
  }
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    fileName: filename,
  })
  new Function('require', 'module', 'exports', outputText)(localRequire, compiledModule, compiledModule.exports)
  cache.set(filename, compiledModule.exports)
  return compiledModule.exports
}
