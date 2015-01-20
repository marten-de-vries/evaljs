"use strict";

var evaljs = require('./index');
var fs = require('fs');
var parse = require('acorn/acorn_csp').parse;

var code = fs.readFileSync('theTest.js', {encoding: 'UTF-8'});

var envGlobal = {console: console, Array: Array, Error: Error, Object: Object};
envGlobal.global = global;
var modLocal = {require: require, exports: {}};

var env = new evaljs.Environment([envGlobal, modLocal]);
env.gen(parse(code))();

