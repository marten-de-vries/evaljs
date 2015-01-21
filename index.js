"use strict";

//TODO:
//- LabeledStatement -> including use in break/continue
//- ForInStatement -> there is a start, finish it.
//- nicer error handling?
//-> TESTS
//-> BENCHMARKS

var parse = require('acorn/acorn_csp').parse;

function noop() {}

function execute(func) {
  return func();
}

function Arguments() {
  //TODO: add es3 'arguments.callee'?
}

Arguments.prototype.toString = function () {
  return '[object Arguments]';
};

function Return(val) {
  this.value = val;
}

// need something unique to compare a against.
var Break = {};
var Continue = {};

function Environment(globalObjects) {
  if (!Array.isArray(globalObjects)) {
    globalObjects = [globalObjects];
  }
  var parent;
  globalObjects.forEach(function (vars) {
    parent = createVarStore(parent, vars);
  });
  // the topmost store is our current store
  this._curVarStore = parent;
  this._curDeclarations = [];
  this._globalObj = globalObjects[0];
  this._curThis = this._globalObj;

  this._boundGen = this._gen.bind(this);
}

function createVarStore(parent, vars) {
  vars = vars || {};
  return {
    parent: parent,
    vars: vars
  };
}

Environment.prototype.gen = function (node) {
  var resp = this._gen(node);
  addDeclarationsToStore(this._curDeclarations, this._curVarStore);
  this._curDeclarations = [];
  return resp;
};

Environment.prototype._gen = function (node) {
  return ({
    BinaryExpression: this._genBinExpr,
    LogicalExpression: this._genBinExpr,
    UnaryExpression: this._genUnaryExpr,
    UpdateExpression: this._genUpdExpr,
    ObjectExpression: this._genObjExpr,
    ArrayExpression: this._genArrExpr,
    CallExpression: this._genCallExpr,
    NewExpression: this._genNewExpr,
    MemberExpression: this._genMemExpr,
    ThisExpression: this._genThisExpr,
    SequenceExpression: this._genSeqExpr,
    Literal: this._genLit,
    Identifier: this._genIdent,
    AssignmentExpression: this._genAssignExpr,
    FunctionDeclaration: this._genFuncDecl,
    VariableDeclaration: this._genVarDecl,
    BlockStatement: this._genProgram,
    Program: this._genProgram,
    ExpressionStatement: this._genExprStmt,
    EmptyStatement: this._genEmptyStmt,
    ReturnStatement: this._genRetStmt,
    FunctionExpression: this._genFuncExpr,
    IfStatement: this._genIfStmt,
    ConditionalExpression: this._genIfStmt,
    ForStatement: this._genLoopStmt,
    WhileStatement: this._genLoopStmt,
    DoWhileStatement: this._genDoWhileStmt,
    ForInStatement: this._genForInStmt,
    WithStatement: this._genWithStmt,
    ThrowStatement: this._genThrowStmt,
    TryStatement: this._genTryStmt,
    ContinueStatement: this._genContStmt,
    BreakStatement: this._genBreakStmt,
    SwitchStatement: this._genSwitchStmt,
  }[node.type] || function () {
    console.warn("Not implemented yet: " + node.type);
    return noop;
  }).call(this, node);
};

Environment.prototype._genBinExpr = function (node) {
  var cmp = {
    '==': function (a, b) {return a == b; },
    '!=': function (a, b) {return a != b; },
    '===': function (a, b) {return a === b; },
    '!==': function (a, b) {return a !== b; },
    '<': function (a, b) {return a < b; },
    '<=': function (a, b) {return a <= b; },
    '>': function (a, b) {return a > b; },
    '>=': function (a, b) {return a >= b; },
    '<<': function (a, b) {return a << b; },
    '>>': function (a, b) {return a >> b; },
    '>>>': function (a, b) {return a >>> b; },
    '+': function (a, b) {return a + b; },
    '-': function (a, b) {return a - b; },
    '*': function (a, b) {return a * b; },
    '/': function (a, b) {return a / b; },
    '%': function (a, b) {return a % b; },
    '|': function (a, b) {return a | b; },
    '^': function (a, b) {return a ^ b; },
    '&': function (a, b) {return a & b; },
    'in': function (a, b) {return a in b; },
    'instanceof': function (a, b) {return a instanceof b; },
    // logic expressions
    '||': function (a, b) {return a || b; },
    '&&': function (a, b) {return a && b; },
  }[node.operator];

  var left = this._gen(node.left);
  var right = this._gen(node.right);
  return function () {
    return cmp(left(), right());
  };
};

Environment.prototype._genUnaryExpr = function (node) {
  var op = {
    '-': function (a) {return -a; },
    '+': function (a) {return +a; },
    '!': function (a) {return !a; },
    '~': function (a) {return ~a; },
    'typeof': function (a) {return typeof a; },
    'void': function (a) {return void a; },
//TODO
//    'delete': function (a) {return delete a; },
  }[node.operator];
  var argument = this._gen(node.argument);

  return function () {
    return op(argument());
  };
};

Environment.prototype._genObjExpr = function (node) {
  //TODO property.kind: don't assume init when it can also be set/get
  var self = this;
  var items = [];
  node.properties.forEach(function (property) {
    // object expression keys are static so can be calculated
    // immediately
    var key = self._objKey(property.key)();
    items.push({
      key: key,
      getVal: self._gen(property.value)
    });
  });
  return function () {
    var result = {};

    items.forEach(function (item) {
      result[item.key] = item.getVal();
    });
    return result;
  };
};

Environment.prototype._genArrExpr = function (node) {
  var items = node.elements.map(this._boundGen);
  return function () {
    return items.map(execute);
  };
};

Environment.prototype._objKey = function (node) {
  var key;
  if (node.type === 'Identifier') {
    key = node.name;
  } else {
    key = this._gen(node)();
  }
  return function () {return key; };
};

Environment.prototype._genCallExpr = function (node) {
  var self = this;

  var callee;
  if (node.callee.type === 'MemberExpression') {
    var obj = self._genObj(node.callee);
    var name = self._genName(node.callee);
    callee = function () {
      var theObj = obj();
      return theObj[name()].bind(theObj);
    };
  } else {
    callee = self._gen(node.callee);
  }
  var args = node.arguments.map(self._gen.bind(self));
  return function () {
    return callee().apply(self._globalObj, args.map(execute));
  };
};

Environment.prototype._genNewExpr = function (node) {
  var callee = this._gen(node.callee);
  var args = node.arguments.map(this._boundGen);
  return function () {
    return newWithArgs(callee(), args.map(execute));
  };
};

function newWithArgs(Cls, args) {
  var allArgs = [Cls].concat(args);
  return new (Function.prototype.bind.apply(Cls, allArgs))();
}

Environment.prototype._genMemExpr = function (node) {
  var obj = this._gen(node.object);
  var property = this._memExprProperty(node);
  return function () {
    return obj()[property()];
  };
};

Environment.prototype._memExprProperty = function (node) {
  return node.computed ? this._gen(node.property) : this._objKey(node.property);
};

Environment.prototype._genThisExpr = function () {
  var self = this;
  return function () {return self._curThis; };
};

Environment.prototype._genSeqExpr = function (node) {
  var exprs = node.expressions.map(this._boundGen);
  return function () {
    var result;
    exprs.forEach(function (expr) {
      result = expr();
    });
    return result;
  };
};

Environment.prototype._genUpdExpr = function (node) {
  var update = {
    '--true': function (obj, name) {return --obj[name]; },
    '--false': function (obj, name) {return obj[name]--; },
    '++true': function (obj, name) {return ++obj[name]; },
    '++false': function (obj, name) {return obj[name]++; },
  }[node.operator + node.prefix];
  var obj = this._genObj(node.argument);
  var name = this._genName(node.argument);
  return function () {
    return update(obj(), name());
  };
};

Environment.prototype._genObj = function (node) {
  if (node.type === 'Identifier') {
    return this._getVarStore.bind(this, node.name);
  } else if (node.type === 'MemberExpression') {
    return this._gen(node.object);
  } else {
    console.warn("Unknown _genObj() type: " + node.type);
    return noop;
  }
};

Environment.prototype._genName = function (node) {
  if (node.type === 'Identifier') {
    return function () {return node.name; };
  } else if (node.type === 'MemberExpression') {
    return this._memExprProperty(node);
  } else {
    console.warn("Unknown _genName() type: " + node.type);
    return noop;
  }
};

Environment.prototype._genLit = function (node) {
  return function () {
    return node.value;
  };
};

Environment.prototype._genIdent = function (node) {
  var self = this;
  return function () {
    return self._getVarStore(node.name)[node.name];
  };
};

Environment.prototype._getVarStore = function (name) {
  var store = this._curVarStore;
  do {
    if (store.vars.hasOwnProperty(name)) {
      return store.vars;
    }
  } while ((store = store.parent));

  // global object as fallback
  return this._globalObj;
};

Environment.prototype._genAssignExpr = function (node) {
  var setter = {
    '=': function (obj, name, val) {return (obj[name] = val); },
    '+=': function (obj, name, val) {return obj[name] += val; },
    '-=': function (obj, name, val) {return obj[name] -= val; },
    '*=': function (obj, name, val) {return obj[name] *= val; },
    '/=': function (obj, name, val) {return obj[name] /= val; },
    '%=': function (obj, name, val) {return obj[name] %= val; },
    '<<=': function (obj, name, val) {return obj[name] <<= val; },
    '>>=': function (obj, name, val) {return obj[name] >>= val; },
    '>>>=': function (obj, name, val) {return obj[name] >>>= val; },
    '|=': function (obj, name, val) {return obj[name] |= val; },
    '^=': function (obj, name, val) {return obj[name] ^= val; },
    '&=': function (obj, name, val) {return obj[name] &= val; },
  }[node.operator];
  var obj = this._genObj(node.left);
  var name = this._genName(node.left);
  var val = this._gen(node.right);
  return function () {
    return setter(obj(), name(), val());
  };
};

Environment.prototype._genFuncDecl = function (node) {
  this._curDeclarations.push(node.id.name);

  node.type = 'FunctionExpression';
  return this._gen({
    type: 'AssignmentExpression',
    operator: '=',
    left: node.id,
    right: node
  });
};

Environment.prototype._genVarDecl = function (node) {
  var assignments = [];
  for (var i = 0; i < node.declarations.length; i++) {
    var decl = node.declarations[i];
    this._curDeclarations.push(decl.id.name);
    if (decl.init) {
      assignments.push({
        type: 'AssignmentExpression',
        operator: '=',
        left: decl.id,
        right: decl.init
      });
    }
  }
  return this._gen({
    type: 'BlockStatement',
    body: assignments
  });
};

Environment.prototype._genFuncExpr = function (node) {
  var self = this;

  var oldDeclarations = self._curDeclarations;
  self._curDeclarations = [];
  var body = self._gen(node.body);
  var declarations = self._curDeclarations;
  self._curDeclarations = oldDeclarations;

  // reset var store
  return function () {
    var parent = self._curVarStore;
    return function () {
      // build arguments object
      var args = new Arguments();
      args.length = arguments.length;
      for (var i = 0; i < arguments.length; i ++) {
        args[i] = arguments[i];
      }
      var varStore = createVarStore(parent);
      addDeclarationsToStore(declarations, varStore);

      varStore.vars.arguments = args;
      // add function args to var store
      node.params.forEach(function (param, i) {
        varStore.vars[param.name] = args[i];
      });

      // switch interpreter 'stack'
      var oldStore = self._curVarStore;
      var oldThis = self._curThis;
      self._curVarStore = varStore;
      self._curThis = this;

      // run function body
      var result = body();

      // switch 'stack' back
      self._curThis = oldThis;
      self._curVarStore = oldStore;

      if (result instanceof Return) {
        return result.value;
      }
    };
  };
};

function addDeclarationsToStore(declarations, varStore) {
  for (var i = 0; i < declarations.length; i++) {
    if (!varStore.vars.hasOwnProperty(declarations[i])) {
      varStore.vars[declarations[i]] = undefined;
    }
  }
}

Environment.prototype._genProgram = function (node) {
  var self = this;
  var stmtClosures = node.body.map(function (stmt) {
    return self._gen(stmt);
  });
  return function () {
    var result;
    for (var i = 0; i < stmtClosures.length; i++) {
      result = stmtClosures[i]();
      if (result === Break || result === Continue || result instanceof Return) {
        break;
      }
    }
    //return last
    return result;
  };
};

Environment.prototype._genExprStmt = function (node) {
  return this._gen(node.expression);
};

Environment.prototype._genEmptyStmt = function () {
  return noop;
};

Environment.prototype._genRetStmt = function (node) {
  var arg = this._gen(node.argument);
  return function () {
    return new Return(arg());
  };
};

Environment.prototype._genIfStmt = function (node) {
  var test = this._gen(node.test);
  var consequent = this._gen(node.consequent);
  var alternate = node.alternate ? this._gen(node.alternate) : noop;

  return function () {
    return test() ? consequent() : alternate();
  };
};

Environment.prototype._genLoopStmt = function (node, body) {
  var init = node.init ? this._gen(node.init) : noop;
  var test = node.test ? this._gen(node.test) : function () {
    return true;
  };
  var update = node.update ? this._gen(node.update) : noop;
  body = body || this._gen(node.body);

  return function () {
    var resp;
    for (init(); test(); update()) {
      var newResp = body();
      if (newResp === Break) {
        break;
      }
      if (newResp === Continue) {
        continue;
      }
      resp = newResp;
      if (newResp instanceof Return) {
        break;
      }
    }
    return resp;
  };
};

Environment.prototype._genDoWhileStmt = function (node) {
  var body = this._gen(node.body);
  var loop = this._genLoopStmt(node, body);

  return function () {
    body();
    return loop();
  };
};

Environment.prototype._genForInStmt = function (node) {
/*  var self = this;
  var left = self._gen(node.left);
  var right = self._gen(node.right);
  var body = self._gen(node.body);

  var left = node.left;
  if (left.type === 'VariableDeclaration') {
    left = left.declarations[0].id;
  }
  return function () {
    var resp;
    for (x in right()) {
      self._genAssignExpr({
        left: left,
        right: {
          type: 'Literal',
          value: x
        }
      })();
      resp = body();
    }
    return resp;
  };*/
  return noop;
};

Environment.prototype._genWithStmt = function (node) {
  var self = this;
  var obj = self._gen(node.object);
  var body = self._gen(node.body);
  return function () {
    self._curVarStore = createVarStore(self._curVarStore, obj());
    var result = body();
    self._curVarStore = self._curVarStore.parent;
    return result;
  };
};

Environment.prototype._genThrowStmt = function (node) {
  var arg = this._gen(node.argument);
  return function () {
    throw arg();
  };
};

Environment.prototype._genTryStmt = function (node) {
  var block = this._gen(node.block);
  var handler = this._genCatchHandler(node.handler);
  var finalizer = node.finalizer ? this._gen(node.finalizer) : null;

  return function () {
    try {
      block();
    } catch (err) {
      var resp = handler(err);
      if (!finalizer) {
        return resp;
      } 
    } finally {
      return finalizer();
    }
  };
};

Environment.prototype._genCatchHandler = function (node) {
  if (!node) {
    return noop;
  }
  var self = this;
  var body = self._gen(node.body);
  return function (err) {
    var old = self._curVarStore.vars[node.param.name];
    self._curVarStore.vars[node.param.name] = err;
    var resp = body();
    self._curVarStore.vars[node.param.name] = old;

    return resp;
  };
};

Environment.prototype._genContStmt = function () {
  return function () {return Continue; };
};

Environment.prototype._genBreakStmt = function () {
  return function () {return Break; };
};

Environment.prototype._genSwitchStmt = function (node) {
  var self = this;

  var discriminant = self._gen(node.discriminant);
  var cases = node.cases.map(function (curCase) {
    return {
      test: curCase.test ? self._gen(curCase.test) : null,
      code: self._genProgram({body: curCase.consequent})
    };
  });

  return function () {
    var foundMatch = false;
    var discriminantVal = discriminant();
    var resp, defaultCase;

    for (var i = 0; i < cases.length; i++) {
      var curCase = cases[i];
      if (!foundMatch) {
        if (!curCase.test) {
          defaultCase = curCase;
          continue;
        }
        if (discriminantVal !== curCase.test()) {
          continue;
        }
        foundMatch = true;
      }
      // foundMatch is guaranteed to be true here
      var newResp = curCase.code();
      if (newResp === Break) {
        return resp;
      }
      resp = newResp;
      if (resp === Continue || resp instanceof Return) {
        return resp;
      }
    }
    if (!foundMatch && defaultCase) {
      return defaultCase.code();
    }
  };
};

exports.Environment = Environment;
exports.evaluate = function (code) {
  var ast = parse(code);
  var env = new Environment(global);
  var resp = env.gen(ast)();
  return resp;
};

//console.log(exports.evaluate("1 + 1"));
