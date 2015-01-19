"use strict";

//TODO:
//- scan blocks for declaration statements before executing
//- throw/break/continue/catch/return
//- SwitchStatement
//- LabeledStatement
//-> TESTS
//-> BENCHMARKS

var parse = require('acorn/acorn_csp').parse;

function noop() {}

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
  var self = this;
  var items = node.elements.map(function (element) {
    return self.gen(element);
  });
  return function () {
    return items.map(function (item) {
      return item();
    });
  };
};

Environment.prototype._objKey = function (node) {
  var key;
  if (node.type === 'Identifier') {
    key = node.name;
  } else {
    key = this.gen(node)();
  }
  return function () {
    return key;
  };
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
  var args = node.arguments.map(function (arg) {
    return self.gen(arg);
  });
  return function () {
    //FIXME globalObj?
    return callee().apply(self._globalObj, args.map(function (arg) {
      return arg();
    }));
  };
};

Environment.prototype.genNewExpr = function (node) {
  var self = this;
  var callee = self.gen(node.callee);
  var args = node.arguments.map(function (arg) {
    return self.gen(arg);
  });
  return function () {
    return newWithArgs(callee(), args.map(function (arg) {
      return arg();
    }));
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

Environment.prototype.genThisExpr = function (node) {
  var self = this;
  return function () {
    return self._curThis;
  };
};

Environment.prototype.genSeqExpr = function (node) {
  var self = this;

  var exprs = node.expressions.map(function (expr) {
    return self.gen(expr);
  });
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

  // global scope
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
  return function () {
    self._curScope.vars[node.id.name] = self.genFuncExpr(node)();
  };
};

Environment.prototype.genVarDecl = function (node) {
  var self = this;
  return function () {
    node.declarations.forEach(function (decl) {
      var val = decl.init ? self.gen(decl.init)() : undefined;
      self._curScope.vars[decl.id.name] = val;
    });
  };
};

Environment.prototype.genFuncExpr = function (node) {
  var self = this;
  var body = self.gen(node.body);
  return function () {
    // TODO: fix 'arguments' V8 perf
    var scope = createScope({}, self._curScope);
    return function () {
      scope.vars.arguments = arguments;
      node.params.forEach(function (param, i) {
        scope.vars[param.name] = scope.vars.arguments[i];
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

      return result;
    };
  };
};

Environment.prototype.genProgram = function (node) {
  var self = this;
  return function () {
    var result;
    node.body.forEach(function (stmt) {
      result = self.gen(stmt)();
    });
    //return last
    return result;
  };
};

Environment.prototype.genExprStmt = function (node) {
  var self = this;
  return function () {
    return self.gen(node.expression)();
  };
};

Environment.prototype.genEmptyStmt = function (node) {
  return noop;
};

Environment.prototype.genRetStmt = function (node) {
  var self = this;
  return function () {
    return self.gen(node.argument)();
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
      resp = body();
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
    body();
    self._curScope = prevScope;
  };
};

exports.Environment = Environment;
exports.evaluate = function (code) {
  var ast = parse(code);
  var env = new Environment(global);
  return env.gen(ast)();
};

console.log(exports.evaluate("1 + 1"));
