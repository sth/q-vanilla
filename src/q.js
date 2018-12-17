// vim:ts=4:sts=4:sw=4:
/*!
 *
 * Copyright 2009-2017 Kris Kowal under the terms of the MIT
 * license found at https://github.com/kriskowal/q/blob/v1/LICENSE
 *
 * With parts by Tyler Close
 * Copyright 2007-2009 Tyler Close under the terms of the MIT X license found
 * at http://www.opensource.org/licenses/mit-license.html
 * Forked at ref_send.js version: 2009-05-11
 *
 * With parts by Mark Miller
 * Copyright (C) 2011 Google Inc.
 *
 * With changes by Stephan Hohe
 * Copyright 2018 Stephan Hohe
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

// shims

// used for fallback in "allResolved"
var noop = function () {};
function notImplementedError(name) {
	return new Error("Q: function" + (name ? " "+name : "") + " not implemented");
}

function notImplemented(obj, name) {
	obj[name] = function() {
		throw notImplementedError(name);
	};
}

function QP_export(names, fun) {
	function setf(name) {
		QPromise.prototype[name] = fun;
		Q[name] = function(object) {
			var p = Q(object);
			return p[name].apply(p, array_slice(arguments, 1));
		};
	}
	if (typeof names === "string") {
		setf(names);
	}
	else {
		names.forEach(setf);
	}
}


// Attempt to make generics safe in the face of downstream
// modifications.
// There is no situation where this is necessary.
// If you need a security guarantee, these primordials need to be
// deeply frozen anyway, and if you don’t need a security guarantee,
// this is just plain paranoid.
// However, this **might** have the nice side-effect of reducing the size of
// the minified code by reducing x.call() to merely x()
// See Mark Miller’s explanation of what this does.
// http://wiki.ecmascript.org/doku.php?id=conventions:safe_meta_programming
var call = Function.call;
function uncurryThis(f) {
    return function () {
        return call.apply(f, arguments);
    };
}
// This is equivalent, but slower:
// uncurryThis = Function_bind.bind(Function_bind.call);
// http://jsperf.com/uncurrythis

var array_slice = uncurryThis(Array.prototype.slice);
var array_reduce = uncurryThis(Array.prototype.reduce);
var array_map = uncurryThis(Array.prototype.map);

function isObject(value) {
    return value === Object(value);
}

// generator related shims

// FIXME: Remove this function once ES6 generators are in SpiderMonkey.
function isStopIteration(exception) {
    return (
        Object.prototype.toString.call(exception) === "[object StopIteration]" ||
        exception instanceof QReturnValue
    );
}

// FIXME: Remove this helper and Q.return once ES6 generators are in
// SpiderMonkey.
var QReturnValue;
if (typeof ReturnValue !== "undefined") {
    QReturnValue = ReturnValue;
} else {
    QReturnValue = function (value) {
        this.value = value;
    };
}

// end of shims
// beginning of real work

class QPromise {
	constructor(nativePromise, inspect) {
		if (inspect === void 0) {
			inspect = { state: "unknown" };
		}
		this._native = nativePromise.then();
		this._inspect = inspect;

		var that = this;
		nativePromise.then(function (value) {
			that._inspect.state = "fulfilled";
			that._inspect.value = value;
		}, function (reason) {
			that._inspect.state = "rejected";
			that._inspect.reason = reason;
		});

		// If trackUnhandledRejections is false, we always add an error handler
		// to the native promise to avoid the host system to complain about
		// unhandled rejections.
		//
		// If trackUnhandledRejections is true we don't do this and let the
		// host system keep track of unhandled exceptions.
		if (!trackUnhandledRejections) {
			this._native.then(void 0, function(){});
		}
	}
}

/**
 * Constructs a promise for an immediate reference, passes promises through, or
 * coerces promises from different systems.
 * @param value immediate reference or promise
 */
function Q(value) {
    // If the object is already a Promise, return it directly.  This enables
    // the resolve function to both be used to created references from objects,
    // but to tolerably coerce non-promises to promises.
    if (value instanceof QPromise) {
        return value;
    }

	if (value instanceof Promise) {
		return new QPromise(value, { state: "pending" });
	}

    // assimilate thenables
    if (isPromiseAlike(value)) {
        return coerce(value);
    } else {
        return Q.fulfill(value);
    }
}
Q.resolve = Q;

/**
 * Performs a task in a future turn of the event loop.
 * @param {Function} task
 */
notImplemented(Q, "nextTick");

class Deferred {
	constructor() {
		var native_resolve, native_reject;
		var native_promise = new Promise(function (resolve, reject) {
			native_resolve = resolve;
			native_reject = reject;
		});
		var promise = new QPromise(native_promise, { state: "pending" });

		this.promise = promise;

		this.resolve = this.resolve.bind(this);
		this.fulfill = this.fulfill.bind(this);
		this.reject = this.reject.bind(this);
	}

	resolve(value) {
		if (value instanceof QPromise) {
			if (promise._inspect.state !== "fulfilled" && promise._inspect.state !== "rejected") {
				if (value._inspect.state === "fulfilled") {
					promise._inspect.state = "fulfilled";
					promise._inspect.value = value._inspect.value;
				}
				else if (value._inspect.state === "rejected") {
					promise._inspect.state = "rejected";
					promise._inspect.reason = value._inspect.reason;
				}
			}
			native_resolve(value._native);
		}
		else {
			if (!isPromiseAlike(value)) {
				if (promise._inspect.state !== "fulfilled" && promise._inspect.state !== "rejected") {
					promise._inspect.state = "fulfilled";
					promise._inspect.value = value;
				}
			}
			native_resolve(value);
		}
	}

	fulfill(value) {
		if (isPromiseAlike(value)) {
			throw notImplementedError("fulfill(thenable)");
		}
		promise._inspect.state = "fulfilled";
		promise._inspect.value = value;
		native_resolve(value);
	}

	reject(reason) {
		promise._inspect.state = "rejected";
		promise._inspect.reason = reason;
		native_reject(reason);
	}
}

notImplemented(Deferred.prototype, "notify");


/**
 * Constructs a {promise, resolve, reject} object.
 *
 * `resolve` is a callback to invoke with a more resolved value for the
 * promise. To fulfill the promise, invoke `resolve` with any value that is
 * not a thenable. To reject the promise, invoke `resolve` with a rejected
 * thenable, or invoke `reject` with the reason directly. To resolve the
 * promise to another thenable, thus putting it in the same state, invoke
 * `resolve` with that other thenable.
 */
Q.defer = defer;
function defer() {
	return new Deferred();
}

/**
 * Creates a Node-style callback that will resolve or reject the deferred
 * promise.
 * @returns a nodeback
 */
Deferred.prototype.makeNodeResolver = function () {
    var self = this;
    return function (error, value) {
        if (error) {
            self.reject(error);
        } else if (arguments.length > 2) {
            self.resolve(array_slice(arguments, 1));
        } else {
            self.resolve(value);
        }
    };
};

/**
 * @param resolver {Function} a function that returns nothing and accepts
 * the resolve, reject, and notify functions for a deferred.
 * @returns a promise that may be resolved with the given resolve and reject
 * functions, or rejected by a thrown exception in resolver
 */
Q.Promise = promise; // ES6
Q.promise = promise;
function promise(resolver) {
    if (typeof resolver !== "function") {
        throw new TypeError("resolver must be a function.");
    }
    var deferred = defer();
    try {
        resolver(deferred.resolve, deferred.reject);
    } catch (reason) {
        deferred.reject(reason);
    }
    return deferred.promise;
}

promise.resolve = Q; // ES6

// XXX experimental.  This method is a way to denote that a local value is
// serializable and should be immediately dispatched to a remote upon request,
// instead of passing a reference.
Q.passByCopy = function (object) {
    //freeze(object);
    //passByCopies.set(object, true);
    return object;
};

QPromise.prototype.passByCopy = function () {
    //freeze(object);
    //passByCopies.set(object, true);
    return this;
};

/**
 * If two promises eventually fulfill to the same value, promises that value,
 * but otherwise rejects.
 * @param x {Any*}
 * @param y {Any*}
 * @returns {Any*} a promise for x and y if they are the same, but a rejection
 * otherwise.
 *
 */
QP_export("join", function (that) {
    return Q([this, that]).spread(function (x, y) {
        if (x === y) {
            // TODO: "===" should be Object.is or equiv
            return x;
        } else {
            throw new Error("Q can't join: not the same: " + x + " " + y);
        }
    });
});

/**
 * Returns a promise for the first of an array of promises to become settled.
 * @param answers {Array[Any*]} promises to race
 * @returns {Any*} the first promise to be settled
 */
QP_export("race", function() {
	return this.then(function (promises) {
		return Promise.race(promises);
	});
});
promise.race = Q.race; // ES6

/**
 * Constructs a Promise with a promise descriptor object and optional fallback
 * function.  The descriptor contains methods like when(rejected), get(name),
 * set(name, value), post(name, args), and delete(name), which all
 * return either a value, a promise for a value, or a rejection.  The fallback
 * accepts the operation name, a resolver, and any further arguments that would
 * have been forwarded to the appropriate method above had a method been
 * provided with the proper name.  The API makes no guarantees about the nature
 * of the returned object, apart from that it is usable whereever promises are
 * bought and sold.
 */
notImplemented(Q, "makePromise");

Q.fromNative = fromNative;
function fromNative(p) {
    return new QPromise(p, { state: "pending" });
}

function toNativeReturn(fun) {
	if (!(fun instanceof Function)) {
		return undefined;
	}
	return function() {
		var ret = fun.apply(this, arguments);
		if (ret instanceof QPromise) {
			return ret._native;
		}
		else {
			return ret;
		}
	};
}

Q.QPromise = QPromise;

QPromise.prototype.inspect = function () {
	return this._inspect;
};

QPromise.prototype.toString = function () {
    return "[object QPromise]";
};

QPromise.prototype.then = function (fulfilled, rejected) {
	return fromNative(this._native.then(toNativeReturn(fulfilled), toNativeReturn(rejected)));
};

/**
 * Works almost like "finally", but not called for rejections.
 * Original resolution value is passed through callback unaffected.
 * Callback may return a promise that will be awaited for.
 * @param {Function} callback
 * @returns {Q.Promise}
 * @example
 * doSomething()
 *   .then(...)
 *   .tap(console.log)
 *   .then(...);
 */
QP_export("tap", function (callback) {
    callback = Q(callback);

    return this.then(function (value) {
        return callback.fcall(value).thenResolve(value);
    });
});

/**
 * Registers an observer on a promise.
 *
 * Guarantees:
 *
 * 1. that fulfilled and rejected will be called only once.
 * 2. that either the fulfilled callback or the rejected callback will be
 *    called, but not both.
 * 3. that fulfilled and rejected will not be called in this turn.
 *
 * @param value      promise or immediate reference to observe
 * @param fulfilled  function to be called with the fulfilled value
 * @param rejected   function to be called with the rejection exception
 * @return promise for the return value from the invoked callback
 */
Q.when = function(value, fulfilled, rejected) {
    return Q(value).then(fulfilled, rejected);
};

QP_export("thenResolve", function (value) {
    return this.then(function () { return value; });
});

QP_export("thenReject", function (reason) {
    return this.then(function () { throw reason; });
});

/**
 * If an object is not a promise, it is as "near" as possible.
 * If a promise is rejected, it is as "near" as possible too.
 * If it’s a fulfilled promise, the fulfillment value is nearer.
 * If it’s a deferred promise and the deferred has been resolved, the
 * resolution is "nearer".
 * @param object
 * @returns most resolved (nearest) form of the object
 */

// XXX should we re-do this?
Q.nearer = nearer;
function nearer(value) {
    if (isPromise(value)) {
        var inspected = value.inspect();
        if (inspected.state === "fulfilled") {
            return inspected.value;
        }
    }
    return value;
}

/**
 * @returns whether the given object is a promise.
 * Otherwise it is a fulfilled value.
 */
Q.isPromise = isPromise;
function isPromise(object) {
    return object instanceof QPromise;
}

Q.isPromiseAlike = isPromiseAlike;
function isPromiseAlike(object) {
    return isObject(object) && typeof object.then === "function";
}

/**
 * @returns whether the given object is a pending promise, meaning not
 * fulfilled or rejected.
 */
Q.isPending = function(object) {
    return isPromise(object) && object.isPending();
};

QPromise.prototype.isPending = function () {
    return this.inspect().state === "pending";
};

/**
 * @returns whether the given object is a value or fulfilled
 * promise.
 */
Q.isFulfilled = function(object) {
    return !isPromise(object) || object.isFulfilled();
};

QPromise.prototype.isFulfilled = function () {
    return this.inspect().state === "fulfilled";
};

/**
 * @returns whether the given object is a rejected promise.
 */
Q.isRejected = function(object) {
    return isPromise(object) && object.isRejected();
};

QPromise.prototype.isRejected = function () {
    return this.inspect().state === "rejected";
};

var trackUnhandledRejections = true;

notImplemented(Q, "resetUnhandledRejections");
notImplemented(Q, "getUnhandledReasons");
Q.stopUnhandledRejectionTracking = function() {
	trackUnhandledRejections = false;
};

/**
 * Constructs a rejected promise.
 * @param reason value describing the failure
 */
Q.reject = function(reason) {
	return new QPromise(Promise.reject(reason), { state: "rejected", reason: reason });
};
promise.reject = Q.reject; // ES6

/**
 * Constructs a fulfilled promise for an immediate reference.
 * @param value immediate reference
 */
Q.fulfill = function(value) {
	if (isPromiseAlike(value)) {
		throw notImplementedError("fulfill(thenable)");
	}
	else {
		return new QPromise(Promise.resolve(value), { state: "fulfilled", value: value });
	}
};

/**
 * Converts thenables to Q promises.
 * @param promise thenable promise
 * @returns a Q promise
 */
function coerce(promise) {
	return new QPromise(Promise.resolve(promise), { state: "pending" });
}

/**
 * Annotates an object such that it will never be
 * transferred away from this process over any promise
 * communication channel.
 * @param object
 * @returns promise a wrapping of that object that
 * additionally responds to the "isDef" message
 * without a rejection.
 */
notImplemented(Q, "master");

/**
 * Spreads the values of a promised array of arguments into the
 * fulfillment callback.
 * @param fulfilled callback that receives variadic arguments from the
 * promised array
 * @param rejected callback that receives the exception if the promise
 * is rejected.
 * @returns a promise for the return value or thrown exception of
 * either callback.
 */
QP_export("spread", function (fulfilled, rejected) {
    return this.all().then(function (array) {
        return fulfilled.apply(void 0, array);
    }, rejected);
});

/**
 * The async function is a decorator for generator functions, turning
 * them into asynchronous generators.  Although generators are only part
 * of the newest ECMAScript 6 drafts, this code does not cause syntax
 * errors in older engines.  This code should continue to work and will
 * in fact improve over time as the language improves.
 *
 * ES6 generators are currently part of V8 version 3.19 with the
 * --harmony-generators runtime flag enabled.  SpiderMonkey has had them
 * for longer, but under an older Python-inspired form.  This function
 * works on both kinds of generators.
 *
 * Decorates a generator function such that:
 *  - it may yield promises
 *  - execution will continue when that promise is fulfilled
 *  - the value of the yield expression will be the fulfilled value
 *  - it returns a promise for the return value (when the generator
 *    stops iterating)
 *  - the decorated function returns a promise for the return value
 *    of the generator or the first rejected promise among those
 *    yielded.
 *  - if an error is thrown in the generator, it propagates through
 *    every following yield until it is caught, or until it escapes
 *    the generator function altogether, and is translated into a
 *    rejection for the promise returned by the decorated generator.
 */
Q.async = function(makeGenerator) {
    return function () {
        // when verb is "send", arg is a value
        // when verb is "throw", arg is an exception
        function continuer(verb, arg) {
            var result;

            // Until V8 3.19 / Chromium 29 is released, SpiderMonkey is the only
            // engine that has a deployed base of browsers that support generators.
            // However, SM's generators use the Python-inspired semantics of
            // outdated ES6 drafts.  We would like to support ES6, but we'd also
            // like to make it possible to use generators in deployed browsers, so
            // we also support Python-style generators.  At some point we can remove
            // this block.

            if (typeof StopIteration === "undefined") {
                // ES6 Generators
                try {
                    result = generator[verb](arg);
                } catch (exception) {
                    return Q.reject(exception);
                }
                if (result.done) {
                    return Q(result.value);
                } else {
                    return Q(result.value).then(callback, errback);
                }
            } else {
                // SpiderMonkey Generators
                // FIXME: Remove this case when SM does ES6 generators.
                try {
                    result = generator[verb](arg);
                } catch (exception) {
                    if (isStopIteration(exception)) {
                        return Q(exception.value);
                    } else {
                        return Q.reject(exception);
                    }
                }
                return Q(result).then(callback, errback);
            }
        }
        var generator = makeGenerator.apply(this, arguments);
        var callback = continuer.bind(continuer, "next");
        var errback = continuer.bind(continuer, "throw");
        return callback();
    };
};

/**
 * The spawn function is a small wrapper around async that immediately
 * calls the generator and also ends the promise chain, so that any
 * unhandled errors are thrown instead of forwarded to the error
 * handler. This is useful because it's extremely common to run
 * generators at the top-level to work with libraries.
 */
Q.spawn = function(makeGenerator) {
    Q.done(Q.async(makeGenerator)());
};

// FIXME: Remove this interface once ES6 generators are in SpiderMonkey.
/**
 * Throws a ReturnValue exception to stop an asynchronous generator.
 *
 * This interface is a stop-gap measure to support generator return
 * values in older Firefox/SpiderMonkey.  In browsers that support ES6
 * generators like Chromium 29, just use "return" in your generator
 * functions.
 *
 * @param value the return value for the surrounding generator
 * @throws ReturnValue exception with the value.
 * @example
 * // ES6 style
 * Q.async(function* () {
 *      var foo = yield getFooPromise();
 *      var bar = yield getBarPromise();
 *      return foo + bar;
 * })
 * // Older SpiderMonkey style
 * Q.async(function () {
 *      var foo = yield getFooPromise();
 *      var bar = yield getBarPromise();
 *      Q.return(foo + bar);
 * })
 */
Q["return"] = function(value) {
    throw new QReturnValue(value);
};

/**
 * The promised function decorator ensures that any promise arguments
 * are settled and passed as values (`this` is also settled and passed
 * as a value).  It will also ensure that the result of a function is
 * always a promise.
 *
 * @example
 * var add = Q.promised(function (a, b) {
 *     return a + b;
 * });
 * add(Q(a), Q(B));
 *
 * @param {function} callback The function to decorate
 * @returns {function} a function that has been decorated.
 */
Q.promised = function(callback) {
    return function () {
        return Q.spread([this, Q.all(arguments)], function (self, args) {
            return callback.apply(self, args);
        });
    };
};

/**
 * sends a message to a value in a future turn
 * @param object* the recipient
 * @param op the name of the message operation, e.g., "when",
 * @param args further arguments to be forwarded to the operation
 * @returns result {Promise} a promise for the result of the operation
 */
notImplemented(Q, "dispatch");
notImplemented(QPromise.prototype, "dispatch");

/**
 * Gets the value of a property in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of property to get
 * @return promise for the property value
 */
QP_export("get", function (key) {
    return this.then(function (value) {
        return value[key];
    });
});

/**
 * Sets the value of a property in a future turn.
 * @param object    promise or immediate reference for object object
 * @param name      name of property to set
 * @param value     new value of property
 * @return promise for the return value
 */
QP_export("set", function (key, rhs) {
    return this.then(function (value) {
        value[key] = rhs;
    });
});

/**
 * Deletes a property in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of property to delete
 * @return promise for the return value
 */
QP_export(["del", "delete"], function (key) {
    return this.then(function (value) {
        delete value[key];
    });
});

/**
 * Invokes a method in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of method to invoke
 * @param value     a value to post, typically an array of
 *                  invocation arguments for promises that
 *                  are ultimately backed with `resolve` values,
 *                  as opposed to those backed with URLs
 *                  wherein the posted value can be any
 *                  JSON serializable object.
 * @return promise for the return value
 */
// bound locally because it is used by other methods
QP_export(["mapply", "post"], function (name, args) {
    return this.then(function (value) {
        // Mark Miller proposes that post with no name should apply a
        // promised function.
        if (name === null || name === void 0) {
            return value.apply(void 0, args);
        } else {
            return value[name].apply(value, args);
        }
    });
});

/**
 * Invokes a method in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of method to invoke
 * @param ...args   array of invocation arguments
 * @return promise for the return value
 */
QP_export(["send", "mcall", "invoke"], function (name /*...args*/) {
    return this.post(name, array_slice(arguments, 1));
});

QPromise.prototype.apply = function (thisp, args) {
    return this.then(function (value) {
        return value.apply(thisp, args);
    });
};

/**
 * Applies the promised function in a future turn.
 * @param object    promise or immediate reference for target function
 * @param args      array of application arguments
 */
QP_export("fapply", function (args) {
    return this.apply(void 0, args);
});

/**
 * Calls the promised function in a future turn.
 * @param object    promise or immediate reference for target function
 * @param ...args   array of application arguments
 */
QP_export(["try", "fcall"], function (/*...args*/) {
    return this.apply(void 0, array_slice(arguments));
});

/**
 * Binds the promised function, transforming return values into a fulfilled
 * promise and thrown errors into a rejected one.
 * @param object    promise or immediate reference for target function
 * @param ...args   array of application arguments
 */
QP_export("fbind", function (/*...args*/) {
    var promise = this;
    var args = array_slice(arguments);
    return function fbound() {
        return promise.apply(
            this,
            args.concat(array_slice(arguments))
        );
    };
});

/**
 * Requests the names of the owned properties of a promised
 * object in a future turn.
 * @param object    promise or immediate reference for target object
 * @return promise for the keys of the eventually settled object
 */
QP_export("keys", function () {
    return this.then(function (value) {
        return Object.keys(value);
    });
});

/**
 * Turns an array of promises into a promise for an array.  If any of
 * the promises gets rejected, the whole array is rejected immediately.
 * @param {Array*} an array (or promise for an array) of values (or
 * promises for values)
 * @returns a promise for an array of the corresponding values
 */
// By Mark Miller
// http://wiki.ecmascript.org/doku.php?id=strawman:concurrency&rev=1308776521#allfulfilled
QP_export("all", function() {
	return this.then(function (rpromises) {
		return Promise.all(rpromises).then(function (rvalues) {
			// Q.all is specified to modify and return the input array
			rpromises.length = 0;
			Array.prototype.push.apply(rpromises, rvalues);
			return rpromises;
		});
	});
});
promise.all = Q.all; // ES6

/**
 * Returns the first resolved promise of an array. Prior rejected promises are
 * ignored.  Rejects only if all promises are rejected.
 * @param {Array*} an array containing values or promises for values
 * @returns a promise fulfilled with the value of the first resolved promise,
 * or a rejected promise if all promises are rejected.
 */
Q.any = any;

function any(promises) {
    if (promises.length === 0) {
        return Q.resolve();
    }

    var deferred = Q.defer();
    var pendingCount = 0;
    array_reduce(promises, function (prev, current, index) {
        var promise = promises[index];

        pendingCount++;

        Q(promise).then(onFulfilled, onRejected);
        function onFulfilled(result) {
            deferred.resolve(result);
        }
        function onRejected(err) {
            pendingCount--;
            if (pendingCount === 0) {
                var rejection = err || new Error("" + err);

                rejection.message = ("Q can't get fulfillment value from any promise, all " +
                    "promises were rejected. Last error message: " + rejection.message);

                deferred.reject(rejection);
            }
        }
    }, undefined);

    return deferred.promise;
}

QPromise.prototype.any = function () {
    return any(this);
};

/**
 * Waits for all promises to be settled, either fulfilled or
 * rejected.  This is distinct from `all` since that would stop
 * waiting at the first rejection.  The promise returned by
 * `allResolved` will never be rejected.
 * @param promises a promise for an array (or an array) of promises
 * (or values)
 * @return a promise for an array of promises
 */
QP_export("allResolved", function() {
    return this.then(function (promises) {
        promises = array_map(promises, Q);
        return Q.all(array_map(promises, function (promise) {
            return Q(promise).then(noop, noop);
        })).then(function () {
            return promises;
        });
    });
});

/**
 * Turns an array of promises into a promise for an array of their states (as
 * returned by `inspect`) when they have all settled.
 * @param {Array[Any*]} values an array (or promise for an array) of values (or
 * promises for values)
 * @returns {Array[State]} an array of states for the respective values.
 */
QP_export("allSettled", function () {
    return this.then(function (promises) {
        return Q.all(array_map(promises, function (promise) {
            promise = Q(promise);
            function regardless() {
                return promise.inspect();
            }
            return promise.then(regardless, regardless);
        }));
    });
});

/**
 * Captures the failure of a promise, giving an oportunity to recover
 * with a callback.  If the given promise is fulfilled, the returned
 * promise is fulfilled.
 * @param {Any*} promise for something
 * @param {Function} callback to fulfill the returned promise if the
 * given promise is rejected
 * @returns a promise for the return value of the callback
 */
QP_export(["fail", "catch"], function (rejected) {
	return fromNative(this._native.catch(toNativeReturn(rejected)));
});

/**
 * Attaches a listener that can respond to progress notifications from a
 * promise's originating deferred. This listener receives the exact arguments
 * passed to ``deferred.notify``.
 * @param {Any*} promise for something
 * @param {Function} callback to receive any progress notifications
 * @returns the given promise, unchanged
 */
notImplemented(Q, "progress");
notImplemented(QPromise.prototype, "progress");

/**
 * Provides an opportunity to observe the settling of a promise,
 * regardless of whether the promise is fulfilled or rejected.  Forwards
 * the resolution to the returned promise when the callback is done.
 * The callback can return a promise to defer completion.
 * @param {Any*} promise
 * @param {Function} callback to observe the resolution of the given
 * promise, takes no arguments.
 * @returns a promise for the resolution of the given promise when
 * ``fin`` is done.
 */
QP_export(["fin", "finally"], function (callback) {
	if (this._native.finally && typeof callback === "function") {
		return fromNative(this._native.finally(toNativeReturn(callback)));
	}

    if (!callback || typeof callback.apply !== "function") {
        throw new Error("Q can't apply finally callback");
    }
    callback = Q(callback);
    return this.then(function (value) {
        return callback.fcall().then(function () {
            return value;
        });
    }, function (reason) {
        // TODO attempt to recycle the rejection with "this".
        return callback.fcall().then(function () {
            throw reason;
        });
    });
});

/**
 * Terminates a chain of promises, forcing rejections to be
 * thrown as exceptions.
 * @param {Any*} promise at the end of a chain of promises
 * @returns nothing
 */
QP_export("done", function (fulfilled, rejected) {
    var onUnhandledError = function (error) {
		if (Q.onerror) {
			Q.onerror(error);
		} else {
			throw error;
		}
    };

    // Avoid unnecessary `nextTick`ing via an unnecessary `when`.
    var promise = fulfilled || rejected ?
        this.then(fulfilled, rejected) :
        this;

    promise._native.then(void 0, onUnhandledError);
});

/**
 * Causes a promise to be rejected if it does not get fulfilled before
 * some milliseconds time out.
 * @param {Any*} promise
 * @param {Number} milliseconds timeout
 * @param {Any*} custom error message or Error object (optional)
 * @returns a promise for the resolution of the given promise if it is
 * fulfilled before the timeout, otherwise rejected.
 */
QP_export("timeout", function (ms, error) {
    var deferred = defer();
    var timeoutId = setTimeout(function () {
        if (!error || "string" === typeof error) {
            error = new Error(error || "Timed out after " + ms + " ms");
            error.code = "ETIMEDOUT";
        }
        deferred.reject(error);
    }, ms);

    this.then(function (value) {
        clearTimeout(timeoutId);
        deferred.resolve(value);
    }, function (exception) {
        clearTimeout(timeoutId);
        deferred.reject(exception);
    });

    return deferred.promise;
});

/**
 * Returns a promise for the given value (or promised value), some
 * milliseconds after it resolved. Passes rejections immediately.
 * @param {Any*} promise
 * @param {Number} milliseconds
 * @returns a promise for the resolution of the given promise after milliseconds
 * time has elapsed since the resolution of the given promise.
 * If the given promise rejects, that is passed immediately.
 */
Q.delay = function (object, timeout) {
    if (timeout === void 0) {
        timeout = object;
        object = void 0;
    }
    return Q(object).delay(timeout);
};

QPromise.prototype.delay = function (timeout) {
    return this.then(function (value) {
        var deferred = defer();
        setTimeout(function () {
            deferred.resolve(value);
        }, timeout);
        return deferred.promise;
    });
};

/**
 * Passes a continuation to a Node function, which is called with the given
 * arguments provided as an array, and returns a promise.
 *
 *      Q.nfapply(FS.readFile, [__filename])
 *      .then(function (content) {
 *      })
 *
 */
QP_export("nfapply", function (args) {
    var deferred = defer();
    var nodeArgs = array_slice(args);
    nodeArgs.push(deferred.makeNodeResolver());
    this.fapply(nodeArgs).fail(deferred.reject);
    return deferred.promise;
});

/**
 * Passes a continuation to a Node function, which is called with the given
 * arguments provided individually, and returns a promise.
 * @example
 * Q.nfcall(FS.readFile, __filename)
 * .then(function (content) {
 * })
 *
 */
QP_export("nfcall", function (/*...args*/) {
    var nodeArgs = array_slice(arguments);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.fapply(nodeArgs).fail(deferred.reject);
    return deferred.promise;
});

/**
 * Wraps a NodeJS continuation passing function and returns an equivalent
 * version that returns a promise.
 * @example
 * Q.nfbind(FS.readFile, __filename)("utf-8")
 * .then(console.log)
 * .done()
 */
QP_export(["nfbind", "denodeify"], function (/*...args*/) {
	var callback = this;
    var baseArgs = array_slice(arguments);
    return function () {
        var nodeArgs = baseArgs.concat(array_slice(arguments));
        var deferred = defer();
        nodeArgs.push(deferred.makeNodeResolver());
        callback.fapply(nodeArgs).fail(deferred.reject);
        return deferred.promise;
    };
});

Q.nbind = function (callback, thisp /*...args*/) {
    var baseArgs = array_slice(arguments, 2);
    return function () {
        var nodeArgs = baseArgs.concat(array_slice(arguments));
        var deferred = defer();
        nodeArgs.push(deferred.makeNodeResolver());
        function bound() {
            return callback.apply(thisp, arguments);
        }
        Q(bound).fapply(nodeArgs).fail(deferred.reject);
        return deferred.promise;
    };
};

QPromise.prototype.nbind = function (/*thisp, ...args*/) {
    var args = array_slice(arguments, 0);
    args.unshift(this);
    return Q.nbind.apply(void 0, args);
};

/**
 * Calls a method of a Node-style object that accepts a Node-style
 * callback with a given array of arguments, plus a provided callback.
 * @param object an object that has the named method
 * @param {String} name name of the method of object
 * @param {Array} args arguments to pass to the method; the callback
 * will be provided by Q and appended to these arguments.
 * @returns a promise for the value or error
 */
QP_export(["nmapply", "npost"], function (name, args) {
    var nodeArgs = array_slice(args || []);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.post(name, nodeArgs).fail(deferred.reject);
    return deferred.promise;
});

/**
 * Calls a method of a Node-style object that accepts a Node-style
 * callback, forwarding the given variadic arguments, plus a provided
 * callback argument.
 * @param object an object that has the named method
 * @param {String} name name of the method of object
 * @param ...args arguments to pass to the method; the callback will
 * be provided by Q and appended to these arguments.
 * @returns a promise for the value or error
 */
QP_export(["nsend", "nmcall", "ninvoke"], function (name /*...args*/) {
    var nodeArgs = array_slice(arguments, 1);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.post(name, nodeArgs).fail(deferred.reject);
    return deferred.promise;
});

/**
 * If a function would like to support both Node continuation-passing-style and
 * promise-returning-style, it can end its internal promise chain with
 * `nodeify(nodeback)`, forwarding the optional nodeback argument.  If the user
 * elects to use a nodeback, the result will be sent there.  If they do not
 * pass a nodeback, they will receive the result promise.
 * @param object a result (or a promise for a result)
 * @param {Function} nodeback a Node.js-style callback
 * @returns either the promise or nothing
 */
QP_export("nodeify", function (nodeback) {
    if (nodeback) {
        this.done(function (value) {
			nodeback(null, value);
        }, function (error) {
			nodeback(error);
        });
    } else {
        return this;
    }
});

Q.noConflict = function() {
    throw new Error("Q.noConflict only works when Q is used as a global");
};

export { Q, Q as default };
