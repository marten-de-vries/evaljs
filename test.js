"use strict";

var fs = require('fs');
var evaljs = require('./index');
var parse = require('acorn').parse;
var requireFromString = require('require-from-string');

function run(iter){
  var result = iter.next();
  while(!result.done) {
    result = iter.next();
  }
  return result.value;
}

// basic
console.log(evaljs.evaluate('1 + 1'));

// theTest.js
var code = fs.readFileSync('theTest.js', {encoding: 'UTF-8'});
var parsedCode = parse(code, {'locations': true});
var env = new evaljs.Environment([{console: console}]);
var iter1 = env.gen(parsedCode)();
run(iter1);

// index.js
var code = fs.readFileSync('index-compiled.js', {encoding: 'UTF-8'});
var script = "var evaljs = requireFromString(code);" +
             "console.log(evaljs.evaluate('30 + 4'));";
var envGlobal = {
  code: code,
  console: console
};
envGlobal.global = global;
var modLocal = {
  requireFromString: requireFromString,
};
var env = new evaljs.Environment([envGlobal, modLocal]);
var iter2 = env.gen(script)();
run(iter2);

// acorn.js
var code = fs.readFileSync(require.resolve('acorn'), {encoding: 'UTF-8'});
var envGlobal = { code: code };
var envModules = { requireFromString: requireFromString };
var env = new evaljs.Environment([envGlobal, envModules]);

// load library
var iter3 = env.gen("var acorn = requireFromString(code);")();
run(iter3);

// parse file
var iter4 = env.gen("acorn.parse('1 + 1');")();
var parsed = run(iter4);

// for bonus points: run the parsed expression
var iter5 = env.gen(parsed)();
console.log(run(iter5));

// using esprima
var esprima = require('esprima');
console.log(evaljs.evaluate(esprima.parse('1 + 1')));