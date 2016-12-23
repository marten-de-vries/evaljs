eval.js
=======

[![Build Status](https://travis-ci.org/marten-de-vries/evaljs.svg?branch=master)](https://travis-ci.org/marten-de-vries/evaljs)
[![Dependency Status](https://david-dm.org/marten-de-vries/evaljs.svg)](https://david-dm.org/marten-de-vries/evaljs)
[![devDependency Status](https://david-dm.org/marten-de-vries/evaljs/dev-status.svg)](https://david-dm.org/marten-de-vries/evaljs#info=devDependencies)

A JavaScript interpreter written in JavaScript.

Why?
----

You might be working in a JavaScript environment where ``eval()`` isn't
allowed (and you have a genuinely good reason why you want to use it).
Maybe this'll slip under the radar. You could also extend this to make
it execute ES6 code in an ES5 environment. PRs welcome!

How?
----

Most of the heavy lifting is done by [acorn][], a JavaScript parser
written in JavaScript. **eval.js** converts the [AST] it generates into
JavaScript function closures, which when run execute the whole program.

It's also possible to use **eval.js** with [esprima][].

[acorn]: http://marijnhaverbeke.nl/acorn/
[AST]: https://en.wikipedia.org/wiki/Abstract_syntax_tree
[esprima]: http://esprima.org/

Command line interface
----------------------

This npm package comes with a REPL which allows you to experiment with
it. It's easy to install and use:

```
marten@procyon:~/git/evaljs$ npm install -g evaljs
marten@procyon:~/git/evaljs$ evaljs
> 1 + 1
2
> new Error('Hello World!')
[Error: Hello World!]
> throw new Error('Hello World!')
Error: Hello World!
    at newWithArgs (/home/marten/git/evaljs/index.js:255:10)
    at /home/marten/git/evaljs/index.js:249:12
    at Array.0 (/home/marten/git/evaljs/index.js:581:11)
    at /home/marten/git/evaljs/index.js:466:31
    at REPLServer.repl.start.eval (/home/marten/git/evaljs/bin/evaljs:12:34)
    at repl.js:249:20
    at REPLServer.repl.start.eval (/home/marten/git/evaljs/bin/evaljs:14:7)
    at Interface.<anonymous> (repl.js:239:12)
    at Interface.EventEmitter.emit (events.js:95:17)
    at Interface._onLine (readline.js:202:10)
> marten@procyon:~/git/evaljs$
```

API
---

- ``evaljs.evaluate(code)``
  A drop in alternative for ``window.eval()``.
- ``new evaljs.Environment([scopesOrGlobalObject])``
  Generates a new JS Environment to 'run' code in. The argument can be
  one of the following:
  - a global object
  - nothing (in this case, '{}' is used as the global object)
  - a list of objects. The first will be the global object, others will
    be other scopes loaded into the interpreter. Kind of like wrapping
    the code in a with statement for each further object in the array.
    This is handy for emulating Node.js (for passing in ``require()``,
    ``exports``, and ``module``.)

  A JS Environment has the following properties:
  - ``env.gen(node)``: Takes either the result of acorn's ``parse()``
    method (an AST), or a JS string containing source code. This
    AST/code will be converted into a function that, when run, executes
    the AST/code passed in and returns the result.
  - ``env.DEBUG``: When set to ``true``, evaljs will write debug
    information to stdout.

Size?
-----

16.3kB min+gzip

License?
--------

ISC

Is it complete?
---------------

No labeled statements; no nice error handling (although there is a
``DEBUG`` option). There are probably bugs. That said, it can run itself
including acorn without modifications, so its supported subset of JS is
usable. PRs containing improvements welcome!

How slow is it?
---------------

Not sure. I only tested with small snippets so far in Node.js, for
which the speed difference isn't notable. But it's probably slow.

Who?
----

**eval.js** is written by Marten de Vries. Maintained by Jason Huggins.
Credits for the original idea go to [closure-interpreter][].

[closure-interpreter]: https://www.npmjs.com/package/closure-interpreter
