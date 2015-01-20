"use strict";

//TODO:
//- scan blocks for declaration statements before executing incl. handle
//  undefined + maybe es5 reference errors in strict mode
//- SwitchStatement
//- LabeledStatement -> including use in break/continue
//-> TESTS
//-> BENCHMARKS
//-> nicer error handling?

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

function Environment(scopesOrGlobalObj) {
  if (!Array.isArray(scopesOrGlobalObj)) {
    scopesOrGlobalObj = [scopesOrGlobalObj];
  }
  var parent;
  scopesOrGlobalObj.forEach(function (vars) {
    parent = createScope(vars, parent);
  });
  // the topmost scope is our current scope
  this._curScope = parent;
  this._globalObj = scopesOrGlobalObj[0];
  this._curThis = this._globalObj;

  this._boundGen = this.gen.bind(this);
}

function createScope(vars, parent) {
  return {
    parent: parent,
    vars: vars
  };
}

Environment.prototype.gen = function (node) {
  return ({
    BinaryExpression: this.genBinExpr,
    LogicalExpression: this.genBinExpr,
    UnaryExpression: this.genUnaryExpr,
    UpdateExpression: this.genUpdExpr,
    ObjectExpression: this.genObjExpr,
    ArrayExpression: this.genArrExpr,
    CallExpression: this.genCallExpr,
    NewExpression: this.genNewExpr,
    MemberExpression: this.genMemExpr,
    ThisExpression: this.genThisExpr,
    SequenceExpression: this.genSeqExpr,
    Literal: this.genLit,
    Identifier: this.genIdent,
    AssignmentExpression: this.genAssignExpr,
    FunctionDeclaration: this.genFuncDecl,
    VariableDeclaration: this.genVarDecl,
    BlockStatement: this.genProgram,
    Program: this.genProgram,
    ExpressionStatement: this.genExprStmt,
    EmptyStatement: this.genEmptyStmt,
    ReturnStatement: this.genRetStmt,
    FunctionExpression: this.genFuncExpr,
    IfStatement: this.genIfStmt,
    ConditionalExpression: this.genIfStmt,
    ForStatement: this.genLoopStmt,
    WhileStatement: this.genLoopStmt,
    DoWhileStatement: this.genDoWhileStmt,
    ForInStatement: this.genForInStmt,
    WithStatement: this.genWithStmt,
    ThrowStatement: this.genThrowStmt,
    TryStatement: this.genTryStmt,
    ContinueStatement: this.genContStmt,
    BreakStatement: this.genBreakStmt,
  }[node.type] || function () {
    console.warn("Not implemented yet: " + node.type);
    return noop;
  }).call(this, node);
};

Environment.prototype.genBinExpr = function (node) {
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

  var left = this.gen(node.left);
  var right = this.gen(node.right);
  return function () {
    return cmp(left(), right());
  };
};

Environment.prototype.genUnaryExpr = function (node) {
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
  var argument = this.gen(node.argument);

  return function () {
    return op(argument());
  };
};

Environment.prototype.genObjExpr = function (node) {
  //TODO property.kind: don't assume init when it can also be set/get
  var self = this;
  var items = [];
  node.properties.forEach(function (property) {
    // object expression keys are static so can be calculated
    // immediately
    var key = self._objKey(property.key)();
    items.push({
      key: key,
      getVal: self.gen(property.value)
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

Environment.prototype.genArrExpr = function (node) {
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
    key = this.gen(node)();
  }
  return function () {return key; };
};

Environment.prototype.genCallExpr = function (node) {
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
    callee = self.gen(node.callee);
  }
  var args = node.arguments.map(self.gen.bind(self));
  return function () {
    return callee().apply(self._globalObj, args.map(execute));
  };
};

Environment.prototype.genNewExpr = function (node) {
  var callee = this.gen(node.callee);
  var args = node.arguments.map(this._boundGen);
  return function () {
    return newWithArgs(callee(), args.map(execute));
  };
};

function newWithArgs(Cls, args) {
  var allArgs = [Cls].concat(args);
  return new (Function.prototype.bind.apply(Cls, allArgs))();
}

Environment.prototype.genMemExpr = function (node) {
  var obj = this.gen(node.object);
  var property = this._memExprProperty(node);
  return function () {
    return obj()[property()];
  };
};

Environment.prototype._memExprProperty = function (node) {
  return node.computed ? this.gen(node.property) : this._objKey(node.property);
};

Environment.prototype.genThisExpr = function () {
  var self = this;
  return function () {return self._curThis; };
};

Environment.prototype.genSeqExpr = function (node) {
  var exprs = node.expressions.map(this._boundGen);
  return function () {
    var result;
    exprs.forEach(function (expr) {
      result = expr();
    });
    return result;
  };
};

Environment.prototype.genUpdExpr = function (node) {
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
    return this._getScopeVars.bind(this, node.name);
  } else if (node.type === 'MemberExpression') {
    return this.gen(node.object);
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

Environment.prototype.genLit = function (node) {
  return function () {
    return node.value;
  };
};

Environment.prototype.genIdent = function (node) {
  var self = this;
  return function () {
    return self._getScopeVars(node.name)[node.name];
  };
};

Environment.prototype._getScopeVars = function (name) {
  var scope = this._curScope;
  do {
    if (scope.vars.hasOwnProperty(name)) {
      return scope.vars;
    }
  } while ((scope = scope.parent));

  // global scope if no other scope has been found
  return this._globalObject;
};

Environment.prototype.genAssignExpr = function (node) {
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
  var val = this.gen(node.right);
  return function () {
    return setter(obj(), name(), val());
  };
};

Environment.prototype.genFuncDecl = function (node) {
  var self = this;
  var func = self.genFuncExpr(node);
  return function () {
    self._curScope.vars[node.id.name] = func();
  };
};

Environment.prototype.genVarDecl = function (node) {
  var self = this;
  var decls = node.declarations.map(function (decl) {
    return {
      name: decl.id.name,
      getVal: decl.init ? self.gen(decl.init) : noop,
    };
  });

  return function () {
    decls.forEach(function (decl) {
      self._curScope.vars[decl.name] = decl.getVal();
    });
  };
};

Environment.prototype.genFuncExpr = function (node) {
  var self = this;
  self._curScope = createScope({}, self._curScope);
  var body = self.gen(node.body);
  // reset scope
  var scope = self._curScope;
  self._curScope = scope.parent;
  return function () {
    return function () {
      // build arguments object
      var args = new Arguments();
      args.length = arguments.length;
      for (var i = 0; i < arguments.length; i ++) {
        args[i] = arguments[i];
      }
      scope.vars.arguments = args;
      // add function args to scope
      node.params.forEach(function (param, i) {
        scope.vars[param.name] = args[i];
      });

      // switch interpreter 'stack'
      var oldScope = self._curScope;
      var oldThis = self._curThis;
      self._curScope = scope;
      self._curThis = this;

      // run function body
      var result = body();

      // switch 'stack' back
      self._curThis = oldThis;
      self._curScope = oldScope;

      if (result instanceof Return) {
        return result.value;
      }
    };
  };
};

Environment.prototype.genProgram = function (node) {
  var self = this;
  var stmtClosures = node.body.map(function (stmt) {
    return self.gen(stmt);
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

Environment.prototype.genExprStmt = function (node) {
  return this.gen(node.expression);
};

Environment.prototype.genEmptyStmt = function () {
  return noop;
};

Environment.prototype.genRetStmt = function (node) {
  var arg = this.gen(node.argument);
  return function () {
    return new Return(arg());
  };
};

Environment.prototype.genIfStmt = function (node) {
  var test = this.gen(node.test);
  var consequent = this.gen(node.consequent);
  var alternate = node.alternate ? this.gen(node.alternate) : noop;

  return function () {
    return test() ? consequent() : alternate();
  };
};

Environment.prototype.genLoopStmt = function (node, body) {
  var init = node.init ? this.gen(node.init) : noop;
  var test = node.test ? this.gen(node.test) : function () {
    return true;
  };
  var update = node.update ? this.gen(node.update) : noop;
  body = body || this.gen(node.body);

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

Environment.prototype.genDoWhileStmt = function (node) {
  var body = this.gen(node.body);
  var loop = this.genLoopStmt(node, body);

  return function () {
    body();
    return loop();
  };
};

Environment.prototype.genForInStmt = function (node) {
/*  var self = this;
  var left = self.gen(node.left);
  var right = self.gen(node.right);
  var body = self.gen(node.body);

  var left = node.left;
  if (left.type === 'VariableDeclaration') {
    left = left.declarations[0].id;
  }
  return function () {
    var resp;
    for (x in right()) {
      self.genAssignExpr({
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

Environment.prototype.genWithStmt = function (node) {
  var self = this;
  var obj = self.gen(node.object);
  var body = self.gen(node.body);
  return function () {
    var prevScope = self._curScope;
    self._curScope = createScope(obj(), prevScope);
    var result = body();
    self._curScope = prevScope;
    return result;
  };
};

Environment.prototype.genThrowStmt = function (node) {
  var arg = this.gen(node.argument);
  return function () {
    throw arg();
  };
};

Environment.prototype.genTryStmt = function (node) {
  var block = this.gen(node.block);
  var handler = this._genCatchHandler(node.handler);
  var finalizer = node.finalizer ? this.gen(node.finalizer) : null;

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
  var body = self.gen(node.body);
  return function (err) {
    var old = self._curScope[node.param.name];
    self._curScope[node.param.name] = err;
    var resp = body();
    self._curScope[node.param.name] = old;

    return resp;
  };
};

Environment.prototype.genContStmt = function () {
  return function () {return Continue; };
};

Environment.prototype.genBreakStmt = function () {
  return function () {return Break; };
};

exports.Environment = Environment;
var evaling = false;
exports.evaluate = function (code) {
  var ast = parse(code);
  evaling = true;
  var env = new Environment(global);
  var resp = env.gen(ast)();
  evaling = false;
  return resp;
};

console.log(exports.evaluate("2 + 1"));
