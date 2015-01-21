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

Size?
-----

15.4kB min+gzip

License?
--------

ISC

Is it complete?
---------------

No labeled statements; no nice error handling; there are probably bugs.
That said, it can run itself so it's supported subset of JS is usable.
PRs welcome!

How slow is it?
---------------

Not sure. I only tested with small snippets so far in Node.js, for
which the speed difference isn't notable. But it's probably slow.

Who?
----

**eval.js** is written by Marten de Vries. Credits for the original idea
go to [closure-interpreter][].

[closure-interpreter]: https://www.npmjs.com/package/closure-interpreter
