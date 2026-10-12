const fs = require('node:fs'),
  path = require('node:path'),
  ts = require('typescript');
exports.loader = function (dependencies = {}) {
  const cache = new Map();
  function load(file) {
    const filename = path.resolve(file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText;
    new Function('require', 'module', 'exports', code)(
      (name) => {
        if (name in dependencies) return dependencies[name];
        if (name.startsWith('@/') || name.startsWith('.')) {
          let next = name.startsWith('@/')
            ? path.resolve('src', name.slice(2))
            : path.resolve(path.dirname(filename), name);
          if (!path.extname(next)) next += '.ts';
          return load(next);
        }
        return require(name);
      },
      module,
      module.exports,
    );
    return module.exports;
  }
  return load;
};
