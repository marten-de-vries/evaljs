// not strict, 'cause we need to parse the with statement
/* jshint strict: false */

// statements after a return are ok for test cases
/* jshint -W027 */

var op = {
	'+': function (a, b) {return a + b; }
}['+'];
console.log(op(2, 2));

function Test(name) {
	this._name = name;
}

Test.prototype.hello = function () {
	console.log("Hello,", this._name + "!");
};

var a = new Test("Marten");
a.hello();

for (var i = 0; i < 4; i += 1) {
	console.log(i);
}

if (1) {
	console.log(2);
}

if (0) {
	console.warn(1);
} else {
	console.error(3);
}

console.log("Hello World!");

(function (name) {
	console.log("Hello", name + "!");
}('Marten'));

var i = 0;
while (i < 2) {
	++i;
	console.log(i);
}

// works if you use 'global' instead of the custom global object that
// only includes 'console'
//
// process.nextTick(function () {
// 	console.log("Later...");
// });

function test(def) {
	return function () {
		return def.abc;
	};
}

console.log(test({abc: []})());

var a = (1, 2);
console.log(a);

var i = 0;
do {
	console.log(i);
	i++;
} while (i < 2);

console.log(1 ? 0 : 1);
console.log(0 ? 0 : 1);

try {
	throw new Error('Hello World!');
} catch (err) {
} finally {
}

for (var i = 0; i < 10; i++) {
	if (i === 1) {
		continue;
	}
	if (i === 3) {
		break;
	}
	console.log(i);
}

/*
var x = 2;
switch (x) {
	case 1:
		console.log(1);
	case 2:
		console.log(2);
	case 3:
		console.log(3);
		break
	case 4:
		console.log(4);
}
*/

/*
for (var key in {a: 1, b: 2}) {
	console.log(key);
}
*/

/*jshint ignore:start*/
with ({a: 1, b: 2}) {
	console.log(a, b);
}
/*jshint ignore:end*/

console.log(function () {
	var x = 4;
	console.log(1);
	if (x) {
		console.log(2);
		for (var i = 0; i < 3; i++) {
			console.log(3);
			return x;
			console.log(5);
		}
		console.log(6);
	}
	console.log(7);
}());
