"use strict";

var evaljs = require('./index');
var fs = require('fs');
var parse = require('acorn').parse;

// basic
console.log(evaljs.evaluate('1 + 1'));

// theTest.js
var code = fs.readFileSync('theTest.js', {encoding: 'UTF-8'});

var env = new evaljs.Environment([{console: console}]);
env.gen(parse(code))();

// index.js
var code = fs.readFileSync('index.js', {encoding: 'UTF-8'});

var envGlobal = {console: console, Array: Array, Error: Error, Object: Object};
envGlobal.global = global;
var modLocal = {require: require, exports: {}};

var env = new evaljs.Environment([envGlobal, modLocal]);
env.gen(code)();

// acorn.js
var code = fs.readFileSync(require.resolve('acorn'), {encoding: 'UTF-8'});
var env = new evaljs.Environment([global, {exports: {}, module: {}}]);
//env.DEBUG = true;

// load library
env.gen(code)();

// parse file
var parsed = env.gen('exports.parse("1+1")')();
// for bonus points: run the parsed expression
console.log(env.gen(parsed)());

// using esprima
var esprima = require('esprima');
console.log(evaljs.evaluate(esprima.parse('1 + 1')));
