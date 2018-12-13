"use strict";
/*jshint newcap: false*/
/*global Q: true, describe: false, it: false, expect: false, beforeEach: false,
         afterEach: false, require: false, jasmine: false, waitsFor: false,
         runs: false */

if (typeof Q === "undefined" && typeof require !== "undefined") {
    // For Node compatibility.
    global.Q = require("../q");
    require("./lib/jasmine-promise");

	// The tests are not made to handle all rejections
	Q.stopUnhandledRejectionTracking();
}

var REASON = "this is not an error, but it might show up in the console";

// In browsers that support strict mode, it'll be `undefined`; otherwise, the global.
var calledAsFunctionThis = (function () { return this; }());

function nextTick(action) {
	Promise.resolve().then(action);
}

afterEach(function () {
    Q.onerror = null;
});

describe("computing sum of integers using promises", function() {
    it("should compute correct result without blowing stack", function () {
        var array = [];
        var iters = 1000;
        for (var i = 1; i <= iters; i++) {
            array.push(i);
        }

        var pZero = Q.fulfill(0);
        var result = array.reduce(function (promise, nextVal) {
            return promise.then(function (currentVal) {
                return Q.fulfill(currentVal + nextVal);
            });
        }, pZero);

        return result.then(function (value) {
            expect(value).toEqual(iters * (iters + 1) / 2);
        });
    });
});

describe("Q function", function () {
    it("should result in a fulfilled promise when given a value", function () {
        expect(Q(5).isFulfilled()).toBe(true);
    });

    it("should be the identity when given promise", function () {
        var f = Q.fulfill(5);
        var r = Q.reject(new Error("aaargh"));
        var p = Q.promise(function () { });

        expect(Q(f)).toBe(f);
        expect(Q(r)).toBe(r);
        expect(Q(p)).toBe(p);
    });
});

describe("defer and when", function () {

    it("resolve before when", function () {
        var turn = 0;
        var deferred = Q.defer();
        deferred.resolve(10);
        var promise = Q.when(deferred.promise, function (value) {
            expect(turn).toEqual(1);
            expect(value).toEqual(10);
        });
        turn++;
        return promise;
    });

    it("reject before when", function () {
        var turn = 0;
        var deferred = Q.defer();
        deferred.reject(-1);
        var promise = Q.when(deferred.promise, function () {
            expect(true).toBe(false);
        }, function (value) {
            expect(turn).toEqual(1);
            expect(value).toEqual(-1);
        });
        turn++;
        return promise;
    });

    it("when before resolve", function () {
        var turn = 0;
        var deferred = Q.defer();
        var promise = deferred.promise.then(function (value) {
            expect(turn).toEqual(2);
            expect(value).toEqual(10);
            turn++;
        });
        nextTick(function () {
            expect(turn).toEqual(1);
            deferred.resolve(10);
            turn++;
        });
        turn++;
        return promise;
    });

    it("when before reject", function () {
        var turn = 0;
        var deferred = Q.defer();
        var promise = deferred.promise.then(function () {
            expect(true).toBe(false);
        }, function (value) {
            expect(turn).toEqual(2);
            expect(value).toEqual(-1);
            turn++;
        });
        nextTick(function () {
            expect(turn).toEqual(1);
            deferred.reject(-1);
            turn++;
        });
        turn++;
        return promise;
    });

    it("resolves multiple observers", function (done) {
        var nextTurn = false;

        var resolution = "Taram pam param!";
        var deferred = Q.defer();
        var count = 10;
        var i = 0;

        function resolve(value) {
            i++;
            expect(value).toBe(resolution);
            expect(nextTurn).toBe(true);
            if (i === count) {
                done();
            }
        }

        while (++i <= count) {
            Q.when(deferred.promise, resolve);
        }

        deferred.resolve(resolution);
        i = 0;
        nextTurn = true;
    });

    it("observers called even after throw", function () {
        var threw = false;
        var deferred = Q.defer();
        Q.when(deferred.promise, function () {
            threw = true;
            throw new Error(REASON);
        });
        var promise = Q.when(deferred.promise, function (value) {
            expect(value).toEqual(10);
        }, function () {
            expect("not").toEqual("here");
        });
        deferred.resolve(10);
        return promise;
    });

    it("returns `undefined` from the deferred's methods", function () {
        expect(Q.defer().resolve()).toBe(undefined);
        expect(Q.defer().reject()).toBe(undefined);
    });

});

describe("always next tick", function () {

    it("generated by `resolve`", function () {
        var turn = 0;
        var promise = Q.when(Q(), function () {
            expect(turn).toEqual(1);
        });
        turn++;
        return promise;
    });

    it("generated by `reject`", function () {
        var turn = 0;
        var promise = Q.when(Q.reject(), function () {
            expect(true).toBe(false);
        }, function () {
            expect(turn).toEqual(1);
        });
        turn++;
        return promise;
    });
});

describe("promises for objects", function () {

    describe("get", function () {

        it("fulfills a promise", function () {
            var deferred = Q.defer();
            deferred.resolve({a: 1});
            return deferred.promise.get("a")
            .then(function (a) {
                expect(a).toBe(1);
            });
        });

        it("propagates a rejection", function () {
            var exception = new Error("boo!");
            return Q.fcall(function () {
                throw exception;
            })
            .get("a")
            .then(function () {
                expect("be").toBe("not to be");
            }, function (_exception) {
                expect(_exception).toBe(exception);
            });
        });

    });

    describe("set", function () {

        it("fulfills a promise", function () {
            var object = {};
            return Q(object)
            .set("a", 1)
            .then(function (result) {
                expect(result).toBe(undefined);
                expect(object.a).toBe(1);
            });
        });

        it("propagates a rejection", function () {
            var exception = new Error("Gah!");
            return Q.reject(exception)
            .set("a", 1)
            .then(function () {
                expect("frozen over").toBe("quite warm");
            }, function (_exception) {
                expect(_exception).toBe(exception);
            });
        });

    });

    describe("del", function () {

        it("fulfills a promise", function () {
            var object = {a: 10};
            return Q.fcall(function () {
                return object;
            })
            .del("a")
            .then(function (result) {
                expect("a" in object).toBe(false);
                expect(result).toBe(void 0);
            }, function () {
                expect("up").toBe("down");
            });
        });

        it("propagates a rejection", function () {
            var exception = new Error("hah-hah");
            return Q.fcall(function () {
                throw exception;
            })
            .del("a")
            .then(function () {
                expect(true).toBe(false);
            }, function (_exception) {
                expect(_exception).toBe(exception);
            });
        });

    });

    describe("post", function () {

        it("fulfills a promise", function () {
            var subject = {
                a: function a(value) {
                    this._a = value;
                    return 1 + value;
                }
            };
            return Q.when(Q.post(subject, "a", [1]), function (two) {
                expect(subject._a).toBe(1);
                expect(two).toBe(2);
            });
        });

        it("works as apply when given no name", function () {
            return Q(function (a, b, c) {
                return a + b + c;
            })
            .post(undefined, [1, 2, 3])
            .then(function (sum) {
                expect(sum).toEqual(6);
            });
        });

    });

    describe("send", function () {

        it("fulfills a promise", function () {
            var foo;
            var subject = {
                foo: function (_bar) {
                    return _bar;
                },
                bar: function (_foo, _bar) {
                    foo = _foo;
                    return this.foo(_bar);
                }
            };
            return Q.send(subject, "bar", 1, 2)
            .then(function (two) {
                expect(foo).toEqual(1);
                expect(two).toEqual(2);
            });
        });

        it("is rejected for undefined method", function () {
            var subject = {};
            return Q(subject)
            .send("foo")
            .then(function () {
                expect("here").toEqual("not here");
            }, function () {
            });
        });

        it("is rejected for undefined object", function () {
            return Q()
            .send("foo")
            .then(function () {
                expect("here").toEqual("not here");
            }, function () {
            });
        });

    });

    describe("keys", function () {

        function Klass (a, b) {
            this.a = a;
            this.b = b;
        }
        Klass.prototype.notOwn = 1;

        it("fulfills a promise", function () {
            return Q.keys(new Klass(10, 20))
            .then(function (keys) {
                expect(keys.sort()).toEqual(["a", "b"]);
            });
        });

    });

});

describe("promises for functions", function () {

    describe("fapply", function () {
        it("fulfills a promise using arguments", function () {
            return Q(function (a, b, c) {
                return a + b + c;
            })
            .fapply([1, 2, 3])
            .then(function (sum) {
                expect(sum).toEqual(6);
            });
        });
    });

    describe("fcall", function () {
        it("fulfills a promise using arguments", function () {
            return Q(function (a, b, c) {
                return a + b + c;
            })
            .fcall(1, 2, 3)
            .then(function (sum) {
                expect(sum).toEqual(6);
            });
        });
    });

    describe("fbind", function () {

        it("accepts a promise for a function", function () {
            return Q.fbind(Q(function (high, low) {
                return high - low;
            }))
            (2, 1)
            .then(function (difference) {
                expect(difference).toEqual(1);
            });
        });

        it("chains partial application on a promise for a function", function () {
            return Q(function (a, b) {
                return a * b;
            })
            .fbind(2)(3)
            .then(function (product) {
                expect(product).toEqual(6);
            });
        });

        it("returns a fulfilled promise", function () {
            var result = {};
            var bound = Q.fbind(function () {
                return result;
            });
            return bound()
            .then(function (_result) {
                expect(_result).toBe(result);
            });
        });

        it("returns a rejected promise from a thrown error", function () {
            var exception = new Error("Boo!");
            var bound = Q.fbind(function () {
                throw exception;
            });
            return bound()
            .then(function () {
                expect("flying pigs").toBe("swillin' pigs");
            }, function (_exception) {
                expect(_exception).toBe(exception);
            });
        });

        it("passes arguments through", function () {
            var x = {}, y = {};
            var bound = Q.fbind(function (a, b) {
                expect(a).toBe(x);
                expect(b).toBe(y);
            });
            return bound(x, y);
        });

        it("passes and also partially applies arguments", function () {
            var x = {}, y = {};
            var bound = Q.fbind(function (a, b) {
                expect(a).toBe(x);
                expect(b).toBe(y);
            }, x);
            return bound(y);
        });

        it("doesn't bind `this`", function () {
            var theThis = { me: "this" };
            var bound = Q.fbind(function () {
                expect(this).toBe(theThis);
            });

            return bound.call(theThis);
        });

    });

});

describe("inspect", function () {

    it("for a fulfilled promise", function () {
        expect(Q(10).inspect()).toEqual({
            state: "fulfilled",
            value: 10
        });
    });

    it("for a rejected promise", function () {
        var error = new Error("In your face.");
        var rejected = Q.reject(error);
        expect(rejected.inspect()).toEqual({
            state: "rejected",
            reason: error
        });
    });

    it("for a pending, unresolved promise", function () {
        var pending = Q.defer().promise;
        expect(pending.inspect()).toEqual({ state: "pending" });
    });

    it("for a promise resolved to a rejected promise", function () {
        var deferred = Q.defer();
        var error = new Error("Rejected!");
        var rejected = Q.reject(error);
        deferred.resolve(rejected);

        expect(deferred.promise.inspect()).toEqual({
            state: "rejected",
            reason: error
        });
    });

    it("for a promise resolved to a fulfilled promise", function () {
        var deferred = Q.defer();
        var fulfilled = Q(10);
        deferred.resolve(fulfilled);

        expect(deferred.promise.inspect()).toEqual({
            state: "fulfilled",
            value: 10
        });
    });

    it("for a promise resolved to a pending promise", function () {
        var a = Q.defer();
        var b = Q.defer();
        a.resolve(b.promise);

        expect(a.promise.inspect()).toEqual({ state: "pending" });
    });

});

describe("promise states", function () {

    it("of fulfilled value", function () {
        expect(Q.isFulfilled(void 0)).toBe(true);
        expect(Q.isRejected(false)).toBe(false);
        expect(Q.isPending(true)).toBe(false);
    });

    it("of fulfillment", function () {
        var promise = Q(10);
        expect(Q.isFulfilled(promise)).toBe(true);
        expect(promise.isFulfilled()).toBe(true);
        expect(Q.isRejected(promise)).toBe(false);
        expect(promise.isRejected()).toBe(false);
        expect(Q.isPending(promise)).toBe(false);
        expect(promise.isPending()).toBe(false);
    });

    it("of rejection", function () {
        var error = new Error("Oh, snap.");
        var promise = Q.reject(error);
        expect(promise.isFulfilled()).toBe(false);
        expect(promise.isRejected()).toBe(true);
        expect(promise.isPending()).toBe(false);
    });

    it("of rejection with a falsy value", function () {
        var promise = Q.reject(undefined);
        expect(promise.isFulfilled()).toBe(false);
        expect(promise.isRejected()).toBe(true);
        expect(promise.isPending()).toBe(false);
    });

    it("of deferred", function () {
        var deferred = Q.defer();
        var promise = deferred.promise;
        expect(promise.isFulfilled()).toBe(false);
        expect(promise.isRejected()).toBe(false);
        expect(promise.isPending()).toBe(true);
    });

    it("of deferred rejection", function () {
        var deferred = Q.defer();
        var rejection = Q.reject(new Error("Rejected!"));
        deferred.resolve(rejection);
        var promise = deferred.promise;
        expect(promise.isFulfilled()).toBe(false);
        expect(promise.isRejected()).toBe(true);
        expect(promise.isPending()).toBe(false);
    });

    it("of deferred fulfillment", function () {
        var deferred = Q.defer();
        deferred.resolve(10);
        var promise = deferred.promise;
        expect(promise.isFulfilled()).toBe(true);
        expect(promise.isRejected()).toBe(false);
        expect(promise.isPending()).toBe(false);
    });

    it("of deferred deferred", function () {
        var a = Q.defer();
        var b = Q.defer();
        a.resolve(b.promise);
        var promise = a.promise;
        expect(promise.isFulfilled()).toBe(false);
        expect(promise.isRejected()).toBe(false);
        expect(promise.isPending()).toBe(true);
    });

    it("of isFulfilled side effects", function () {
        var deferred = Q.defer();
        var finished = false;

        waitsFor(function () {
            return finished;
        });

        var parentPromise = deferred.promise;

        var childPromise = parentPromise.then(function () {
            expect(parentPromise.isFulfilled()).toBe(true);
            expect(childPromise.isFulfilled()).toBe(false);

            return parentPromise.then(function (value) {
                finished = true;
                return value + 1;
            });
        });

        deferred.resolve(1);

        runs(function () {
            expect(childPromise.isPending()).toBe(false);
            expect(childPromise.isRejected()).toBe(false);
            expect(childPromise.isFulfilled()).toBe(true);
            expect(childPromise.inspect().value).toBe(2);
        });
    });

});

describe("propagation", function () {

    it("propagate through then with no callback", function () {
        return Q(10)
        .then()
        .then(function (ten) {
            expect(ten).toBe(10);
        });
    });

    it("propagate through then with modifying callback", function () {
        return Q(10)
        .then(function (ten) {
            return ten + 10;
        })
        .then(function (twen) {
            expect(twen).toBe(20);
        });
    });

    it("errback recovers from exception", function () {
        var error = new Error("Bah!");
        return Q.reject(error)
        .then(null, function (_error) {
            expect(_error).toBe(error);
            return 10;
        })
        .then(function (value) {
            expect(value).toBe(10);
        });
    });

    it("rejection propagates through then with no errback", function () {
        var error = new Error("Foolish mortals!");
        return Q.reject(error)
        .then()
        .then(null, function (_error) {
            expect(_error).toBe(error);
        });
    });

    it("rejection intercepted and rethrown", function () {
        var error = new Error("Foolish mortals!");
        var nextError = new Error("Silly humans!");
        return Q.reject(error)
        .fail(function () {
            throw nextError;
        })
        .then(null, function (_error) {
            expect(_error).toBe(nextError);
        });
    });

    it("resolution is forwarded through deferred promise", function () {
        var a = Q.defer();
        var b = Q.defer();
        a.resolve(b.promise);
        b.resolve(10);
        return a.promise.then(function (eh) {
            expect(eh).toEqual(10);
        });
    });
});

describe("all", function () {
    it("fulfills when passed an empty array", function () {
        return Q.all([]);
    });

    it("rejects after any constituent promise is rejected", function () {
        var toResolve = Q.defer(); // never resolve
        var toReject = Q.defer();
        var promises = [toResolve.promise, toReject.promise];
        var promise = Q.all(promises);

        toReject.reject(new Error("Rejected"));

        return Q.delay(250)
        .then(function () {
            expect(promise.isRejected()).toBe(true);
        })
        .timeout(1000);
    });

    it("resolves foreign thenables", function () {
        var normal = Q(1);
        var foreign = { then: function (f) { f(2); } };

        return Q.all([normal, foreign])
        .then(function (result) {
            expect(result).toEqual([1, 2]);
        });
    });

    it("fulfills when passed an sparse array", function () {
        var toResolve = Q.defer();
        var promises = [];
        promises[0] = Q(0);
        promises[2] = toResolve.promise;
        var promise = Q.all(promises);

        toResolve.resolve(2);

        return promise.then(function (result) {
            expect(result).toEqual([0, void 0, 2]);
        });
    });

    it("modifies the input array", function () {
        var input = [Q(0), Q(1)];

        return Q.all(input).then(function (result) {
            expect(result).toBe(input);
            expect(input).toEqual([0, 1]);
        });
    });

});

describe("any", function() {
    it("fulfills when passed an empty array", function() {
        return Q.any([]);
    });

    it("rejects after all promises are rejected", function() {
        var deferreds = [Q.defer(), Q.defer()];
        var promises = [deferreds[0].promise, deferreds[1].promise];

        return testReject(promises, deferreds, new Error("Rejected"));
    });

    it("rejects after all promises in a sparse array are rejected", function() {
        var deferreds = [Q.defer(), Q.defer()];
        var promises = [];
        promises[0] = deferreds[0].promise;
        promises[3] = deferreds[1].promise;

        return testReject(promises, deferreds, new Error("Rejected"));
    });


    it("rejects after all promises are rejected with null", function() {
        var deferreds = [Q.defer(), Q.defer()];
        var promises = [deferreds[0].promise, deferreds[1].promise];

        return testReject(promises, deferreds, null);
    });

    it("rejects after all promises are rejected with undefined", function() {
        var deferreds = [Q.defer(), Q.defer()];
        var promises = [deferreds[0].promise, deferreds[1].promise];

        return testReject(promises, deferreds, undefined);
    });

    function testReject(promises, deferreds, rejectionValue) {
        var promise = Q.any(promises);
        var expectedError;

        if (rejectionValue) {
          expectedError = new Error(rejectionValue.message);
        } else {
          expectedError = new Error("" + rejectionValue);
        }

        for (var index = 0; index < deferreds.length; index++) {
            var deferred = deferreds[index];
            (function() {
              deferred.reject(rejectionValue);
            })();
        }

        return Q.delay(250)
          .then(function() {
              expect(promise.isRejected()).toBe(true);
              expect(promise.inspect().reason).toEqual(expectedError);
              expect(promise.inspect().reason.message)
                .toBe("Q can't get fulfillment value from any promise, all promises were rejected. Last error message: " + expectedError.message);
          })
          .timeout(1000);
    }

    it("fulfills with the first resolved promise", function() {
        var deferreds = [Q.defer(), Q.defer()];
        var promises = [deferreds[0].promise, deferreds[1].promise];

        testFulfill(promises, deferreds);
    });

    it("fulfills when passed a sparse array", function() {
        var deferreds = [Q.defer(), Q.defer()];
        var promises = [];
        promises[0] = deferreds[0].promise;
        promises[2] = deferreds[1].promise;

        testFulfill(promises, deferreds);
    });

    function testFulfill(promises, deferreds) {
        var promise = Q.any(promises);

        var j = 1;
        for (var index = 0; index < deferreds.length; index++) {
            var toResolve = deferreds[index];
            if (!toResolve || !Q.isPromiseAlike(toResolve.promise)) {
                continue;
            }

            (function(index, toResolve) {
                var time = index * 50;
                Q.delay(time).then(function() {
                    toResolve.resolve('Fulfilled' + index);
                });
            })(j, toResolve);

            j++;
        }

        return Q.delay(400)
          .then(function() {
              expect(promise.isFulfilled()).toBe(true);
              expect(promise.inspect().value).toBe('Fulfilled1');
          })
          .timeout(1000);
    }

    it("fulfills with the first value", function() {
        var toResolve1 = Q.defer();
        var toResolve2 = Q.defer();
        var toResolve3 = Q.defer();
        var promises = [toResolve1.promise, toResolve2.promise, 4, 5,
            toResolve3.promise
        ];

        var promise = Q.any(promises);

        Q.delay(150).then(function() {
            toResolve1.resolve(1);
        });
        Q.delay(50).then(function() {
            toResolve2.resolve(2);
        });
        Q.delay(100).then(function() {
            toResolve3.resolve(3);
        });

        return Q.delay(250)
          .then(function() {
              expect(promise.isFulfilled()).toBe(true);
              expect(promise.inspect().value).toBe(4);
          })
          .timeout(1000);
    });

    it("fulfills after rejections", function() {
        var toReject = [Q.defer(), Q.defer()];
        var toResolve = Q.defer();
        var promises = [toReject[0].promise, toReject[1].promise,
            toResolve
            .promise
        ];

        var promise = Q.any(promises);

        testFulfillAfterRejections(promises, toReject, toResolve);
    });

    it("fulfills after rejections in sparse array", function() {
        var toReject = [Q.defer(), Q.defer()];
        var toResolve = Q.defer();
        var promises = [];
        promises[2] = toReject[0].promise;
        promises[5] = toReject[1].promise;
        promises[9] = toResolve.promise;

        testFulfillAfterRejections(promises, toReject, toResolve);
    });

    function testFulfillAfterRejections(promises, rejectDeferreds,
      fulfillDeferred) {
        var promise = Q.any(promises);

        for (var index = 0; index < rejectDeferreds.length; index++) {
            var toReject = rejectDeferreds[index];
            (function(index, toReject) {
                var time = (index + 1) * 50;
                Q.delay(time).then(function() {
                    toReject.reject(new Error('Rejected'));
                });
            })(index, toReject);

            index++;
        }
        Q.delay(index * 50).then(function() {
            fulfillDeferred.resolve('Fulfilled');
        });

        return Q.delay(400)
          .then(function() {
              expect(promise.isFulfilled()).toBe(true);
              expect(promise.inspect().value).toBe('Fulfilled');
          })
          .timeout(1000);
    }

    it("resolves foreign thenables", function() {
        var normal = Q.delay(150)
            .then(function() {})
            .thenResolve(1);
        var foreign = {
            then: function(f) {
                return f(2);
            }
        };

        return Q.any([normal, foreign])
          .then(function(result) {
              expect(result).toEqual(2);
          });
    });

});

describe("allSettled", function () {
    it("works on an empty array", function () {
        return Q.allSettled([])
        .then(function (snapshots) {
            expect(snapshots).toEqual([]);
        });
    });

    it("deals with a mix of non-promises and promises", function () {
        return Q.allSettled([1, Q(2), Q.reject(3)])
        .then(function (snapshots) {
            expect(snapshots).toEqual([
                { state: "fulfilled", value: 1 },
                { state: "fulfilled", value: 2 },
                { state: "rejected", reason: 3 }
            ]);
        });
    });

    it("is settled after every constituent promise is settled", function () {
        var toFulfill = Q.defer();
        var toReject = Q.defer();
        var promises = [toFulfill.promise, toReject.promise];
        var fulfilled;
        var rejected;

        Q.fcall(function () {
            toReject.reject();
            rejected = true;
        })
        .delay(15)
        .then(function () {
            toFulfill.resolve();
            fulfilled = true;
        });

        return Q.allSettled(promises)
        .then(function () {
            expect(fulfilled).toBe(true);
            expect(rejected).toBe(true);
        });
    });

    it("does not modify the input array", function () {
        var input = [1, Q(2), Q.reject(3)];

        return Q.allSettled(input)
        .then(function (snapshots) {
            expect(snapshots).not.toBe(input);
            expect(snapshots).toEqual([
                { state: "fulfilled", value: 1 },
                { state: "fulfilled", value: 2 },
                { state: "rejected", reason: 3 }
            ]);
        });
    });

});

describe("spread", function () {

    it("spreads values across arguments", function () {
        return Q.spread([1, 2, 3], function (a, b) {
            expect(b).toBe(2);
        });
    });

    it("spreads promises for arrays across arguments", function () {
        return Q([Q(10)])
        .spread(function (value) {
            expect(value).toEqual(10);
        });
    });

    it("spreads arrays of promises across arguments", function () {
        var deferredA = Q.defer();
        var deferredB = Q.defer();

        var promise = Q.spread([deferredA.promise, deferredB.promise],
                               function (a, b) {
            expect(a).toEqual(10);
            expect(b).toEqual(20);
        });

        Q.delay(5).then(function () {
            deferredA.resolve(10);
        });
        Q.delay(10).then(function () {
            deferredB.resolve(20);
        });

        return promise;
    });

    it("calls the errback when given a rejected promise", function () {
        var err = new Error();
        return Q.spread([Q(10), Q.reject(err)],
            function () {
                expect(true).toBe(false);
            },
            function (actual) {
                expect(actual).toBe(err);
            }
        );
    });

});

describe("fin", function () {

    var exception1 = new Error("boo!");
    var exception2 = new TypeError("evil!");

    describe("when the promise is fulfilled", function () {

        it("should call the callback", function () {
            var called = false;

            return Q("foo")
            .fin(function () {
                called = true;
            })
            .then(function () {
                expect(called).toBe(true);
            });
        });

        it("should fulfill with the original value", function () {
            return Q("foo")
            .fin(function () {
                return "bar";
            })
            .then(function (result) {
                expect(result).toBe("foo");
            });
        });

        describe("when the callback returns a promise", function () {

            describe("that is fulfilled", function () {
                it("should fulfill with the original reason after that promise resolves", function () {
                    var promise = Q.delay(250);

                    return Q("foo")
                    .fin(function () {
                        return promise;
                    })
                    .then(function (result) {
                        expect(Q.isPending(promise)).toBe(false);
                        expect(result).toBe("foo");
                    });
                });
            });

            describe("that is rejected", function () {
                it("should reject with this new rejection reason", function () {
                    return Q("foo")
                    .fin(function () {
                        return Q.reject(exception1);
                    })
                    .then(function () {
                        expect(false).toBe(true);
                    },
                    function (exception) {
                        expect(exception).toBe(exception1);
                    });
                });
            });

        });

        describe("when the callback throws an exception", function () {
            it("should reject with this new exception", function () {
                return Q("foo")
                .fin(function () {
                    throw exception1;
                })
                .then(function () {
                    expect(false).toBe(true);
                },
                function (exception) {
                    expect(exception).toBe(exception1);
                });
            });
        });

    });

    describe("when the promise is rejected", function () {

        it("should call the callback", function () {
            var called = false;

            return Q.reject(exception1)
            .fin(function () {
                called = true;
            })
            .then(function () {
                expect(called).toBe(true);
            }, function () {
                expect(called).toBe(true);
            });
        });

        it("should reject with the original reason", function () {
            return Q.reject(exception1)
            .fin(function () {
                return "bar";
            })
            .then(function () {
                expect(false).toBe(true);
            },
            function (exception) {
                expect(exception).toBe(exception1);
            });
        });

        describe("when the callback returns a promise", function () {

            describe("that is fulfilled", function () {
                it("should reject with the original reason after that promise resolves", function () {
                    var promise = Q.delay(250);

                    return Q.reject(exception1)
                    .fin(function () {
                        return promise;
                    })
                    .then(function () {
                        expect(false).toBe(true);
                    },
                    function (exception) {
                        expect(exception).toBe(exception1);
                        expect(Q.isPending(promise)).toBe(false);
                    });
                });
            });

            describe("that is rejected", function () {
                it("should reject with the new reason", function () {
                    return Q.reject(exception1)
                    .fin(function () {
                        return Q.reject(exception2);
                    })
                    .then(function () {
                        expect(false).toBe(true);
                    },
                    function (exception) {
                        expect(exception).toBe(exception2);
                    });
                });
            });

        });

        describe("when the callback throws an exception", function () {
            it("should reject with this new exception", function () {
                return Q.reject(exception1)
                .fin(function () {
                    throw exception2;
                })
                .then(function () {
                    expect(false).toBe(true);
                },
                function (exception) {
                    expect(exception).toBe(exception2);
                });
            });
        });

    });

    describe("when the callback is invalid", function () {
        describe("undefined", function () {
            it("should have a useful error", function () {
                var foo = {},
                    threw = false;

                try {
                    Q().fin(foo.bar);
                } catch (err) {
                    expect(err.message).toBe("Q can't apply finally callback");
                    threw = true;
                }

                expect(threw).toBe(true);
            });
        });

        describe("not a function", function () {
            it("should have a useful error", function () {
                var threw = false;

                try {
                    Q().fin(123);
                } catch (err) {
                    expect(err.message).toBe("Q can't apply finally callback");
                    threw = true;
                }

                expect(threw).toBe(true);
            });
        });
    });
});

// Almost like "fin"
describe("tap", function () {
    var exception1 = new Error("boo!");

    describe("when the promise is fulfilled", function () {
        it("should call the callback", function () {
            var called = false;
            return Q("foo")
                .tap(function () {
                    called = true;
                })
                .then(function () {
                    expect(called).toBe(true);
                });
        });

        it("should fulfill with the original value", function () {
            return Q("foo")
                .tap(function () {
                    return "bar";
                })
                .then(function (result) {
                    expect(result).toBe("foo");
                });
        });

        describe("when the callback returns a promise", function () {
            describe("that is fulfilled", function () {
                it("should fulfill with the original reason after that promise resolves", function () {
                    var promise = Q.delay(250);

                    return Q("foo")
                        .tap(function () {
                            return promise;
                        })
                        .then(function (result) {
                            expect(Q.isPending(promise)).toBe(false);
                            expect(result).toBe("foo");
                        });
                });
            });

            describe("that is rejected", function () {
                it("should reject with this new rejection reason", function () {
                    return Q("foo")
                        .tap(function () {
                            return Q.reject(exception1);
                        })
                        .then(function () {
                            expect(false).toBe(true);
                        },
                        function (exception) {
                            expect(exception).toBe(exception1);
                        });
                });
            });

        });

        describe("when the callback throws an exception", function () {
            it("should reject with this new exception", function () {
                return Q("foo")
                    .tap(function () {
                        throw exception1;
                    })
                    .then(function () {
                        expect(false).toBe(true);
                    },
                    function (exception) {
                        expect(exception).toBe(exception1);
                    });
            });
        });

    });

    describe("when the promise is rejected", function () {
        it("should not call the callback", function () {
            var called = false;

            return Q.reject(exception1)
                .tap(function () {
                    called = true;
                })
                .then(function () {
                    expect(called).toBe(false);
                }, function () {
                    expect(called).toBe(false);
                });
        });
    });
});


describe("done", function () {
    describe("when the promise is fulfilled", function () {
        describe("and the callback does not throw", function () {
            it("should call the callback and return nothing", function () {
                var called = false;

                var promise = Q();

                var returnValue = promise.done(function () {
                    called = true;
                });

                return promise.fail(function () { }).fin(function () {
                    expect(called).toBe(true);
                    expect(returnValue).toBe(undefined);
                });
            });
        });

        describe("and the callback throws", function () {
            it("should rethrow that error in the next turn and return nothing", function () {
                var turn = 0;
                nextTick(function () {
                    ++turn;
                });

                var returnValue = Q().done(
                    function () {
                        throw "foo";
                    }
                );

                var deferred = Q.defer();
                Q.onerror = function (error) {
                    expect(turn).toBe(1);
                    expect(error).toBe("foo");
                    expect(returnValue).toBe(undefined);
                    deferred.resolve();
                };
                Q.delay(100).then(deferred.reject);

                return deferred.promise;
            });
        });
    });

    describe("when the promise is rejected", function () {
        describe("and the errback handles it", function () {
            it("should call the errback and return nothing", function () {
                var called = false;

                var promise = Q.reject(new Error());

                var returnValue = promise.done(
                    function () { },
                    function () {
                        called = true;
                    }
                );

                return promise.fail(function () { }).fin(function () {
                    expect(called).toBe(true);
                    expect(returnValue).toBe(undefined);
                });
            });
        });

        describe("and the errback throws", function () {
            it("should rethrow that error in the next turn and return nothing", function () {
                var turn = 0;
                nextTick(function () {
                    ++turn;
                });

                var returnValue = Q.reject("bar").done(
                    null,
                    function () {
                        throw "foo";
                    }
                );

                var deferred = Q.defer();
                Q.onerror = function (error) {
                    expect(turn).toBe(1);
                    expect(error).toBe("foo");
                    expect(returnValue).toBe(undefined);
                    deferred.resolve();
                };
                Q.delay(100).then(deferred.reject);

                return deferred.promise;
            });
        });

        describe("and there is no errback", function () {
            it("should throw the original error in the next turn", function () {
                var turn = 0;
                nextTick(function () {
                    ++turn;
                });

                var returnValue = Q.reject("bar").done();

                var deferred = Q.defer();
                Q.onerror = function (error) {
                    expect(turn).toBe(1);
                    expect(error).toBe("bar");
                    expect(returnValue).toBe(undefined);
                    deferred.resolve();
                };
                Q.delay(10).then(deferred.reject);

                return deferred.promise;
            });
        });
    });
});

describe("timeout", function () {
    it("should do nothing if the promise fulfills quickly", function () {
        return Q.delay(10).timeout(200);
    });

    it("should do nothing if the promise rejects quickly", function () {
        var goodError = new Error("haha!");
        return Q.delay(10)
        .then(function () {
            throw goodError;
        })
        .timeout(200)
        .then(undefined, function (error) {
            expect(error).toBe(goodError);
        });
    });

    it("should reject with a timeout error if the promise is too slow", function () {
        return Q.delay(100)
        .timeout(10)
        .then(
            function () {
                expect(true).toBe(false);
            },
            function (error) {
                expect(/time/i.test(error.message)).toBe(true);
            }
        );
    });

    it("should reject with a custom timeout error if the promise is too slow and msg was provided", function () {
        return Q.delay(100)
        .timeout(10, "custom")
        .then(
            function () {
                expect(true).toBe(false);
            },
            function (error) {
                expect(/custom/i.test(error.message)).toBe(true);
                expect(error.code).toBe("ETIMEDOUT");
            }
        );
    });

    it("should reject with a custom timeout error if the promise is too slow and Error object was provided", function () {
        var customError = new Error("custom");
        customError.isCustom = true;
        return Q.delay(100)
        .timeout(10, customError)
        .then(
            function () {
                expect(true).toBe(false);
            },
            function (error) {
                expect(/custom/i.test(error.message)).toBe(true);
                expect(error.isCustom).toBe(true);
            }
        );
    });

});

describe("delay", function () {
    it("should delay fulfillment", function () {
        var promise = Q(5).delay(50);

        setTimeout(function () {
            expect(promise.isPending()).toBe(true);
        }, 40);

        return promise;
    });

    it("should not delay rejection", function () {
        var promise = Q.reject(5).delay(50);

        return Q.delay(20).then(function () {
            expect(promise.isPending()).toBe(false);
        });
    });

    it("should treat a single argument as a time", function () {
        var promise = Q.delay(50);

        setTimeout(function () {
            expect(promise.isPending()).toBe(true);
        }, 40);

        return promise;
    });

    it("should treat two arguments as a value + a time", function () {
        var promise = Q.delay("what", 50);

        setTimeout(function () {
            expect(promise.isPending()).toBe(true);
        }, 40);

        return promise.then(function (value) {
            expect(value).toBe("what");
        });
    });

    it("should delay after resolution", function () {
        var promise1 = Q.delay("what", 30);
        var promise2 = promise1.delay(30);

        setTimeout(function () {
            expect(promise1.isPending()).toBe(false);
            expect(promise2.isPending()).toBe(true);
        }, 40);

        return promise2.then(function (value) {
            expect(value).toBe("what");
        });
    });

});

describe("thenResolve", function () {
    describe("Resolving with a non-thenable value", function () {
        it("returns a promise for that object once the promise is resolved", function () {
            var waited = false;
            return Q.delay(20)
                .then(function () {
                    waited = true;
                })
                .thenResolve("foo")
                .then(function (val) {
                    expect(waited).toBe(true);
                    expect(val).toBe("foo");
                });
        });

        describe("based off a rejected promise", function () {
            it("does nothing, letting the rejection flow through", function () {
                return Q.reject("boo")
                    .thenResolve("foo")
                    .then(
                        function () {
                            expect(true).toBe(false);
                        },
                        function (reason) {
                            expect(reason).toBe("boo");
                        }
                    );
            });
        });
    });

    describe("Resolving with an promise", function () {
        it("returns a promise for the result of that promise once the promise is resolved", function () {
            var waited = false;
            return Q.delay(20)
                .then(function () {
                    waited = true;
                })
                .thenResolve(Q("foo"))
                .then(function (val) {
                    expect(waited).toBe(true);
                    expect(val).toBe("foo");
                });
        });
    });
});

describe("thenReject", function () {
    describe("Rejecting with a reason", function () {
        it("returns a promise rejected with that object once the original promise is resolved", function () {
            var waited = false;
            return Q.delay(20)
                .then(function () {
                    waited = true;
                })
                .thenReject("foo")
                .then(
                    function () {
                        expect(true).toBe(false);
                    },
                    function (reason) {
                        expect(waited).toBe(true);
                        expect(reason).toBe("foo");
                    }
                );
        });

        describe("based off a rejected promise", function () {
            it("does nothing, letting the rejection flow through", function () {
                return Q.reject("boo")
                    .thenResolve("foo")
                    .then(
                        function () {
                            expect(true).toBe(false);
                        },
                        function (reason) {
                            expect(reason).toBe("boo");
                        }
                    );
            });
        });
    });
});

describe("thenables", function () {

    it("assimilates a thenable with fulfillment with resolve", function () {
        return Q({
            then: function (resolved) {
                resolved(10);
            }
        })
        .then(function (ten) {
            expect(ten).toEqual(10);
        })
        .then(function (undefined) {
            expect(undefined).toEqual(void 0);
        });
    });

    it("flows fulfillment into a promise pipeline", function () {
        return Q({
            then: function (resolved) {
                resolved([10]);
            }
        })
        .get(0)
        .then(function (ten) {
            expect(ten).toEqual(10);
        });
    });

    it("assimilates an immediately-fulfilled thenable in allSettled", function () {
        return Q.allSettled([
            {then: function (win) {
                win(10);
            }}
        ])
        .then(function (snapshots) {
            expect(snapshots).toEqual([{ state: "fulfilled", value: 10 }]);
        });
    });

    it("assimilates an eventually-fulfilled thenable in allSettled", function () {
        return Q.allSettled([
            {then: function (win) {
                setTimeout(function () {
                    win(10);
                }, 100);
            }}
        ])
        .then(function (snapshots) {
            expect(snapshots).toEqual([{ state: "fulfilled", value: 10 }]);
        });
    });

});

describe("node support", function () {

    var exception = new Error("That is not your favorite color.");

    var obj = {
        method: function (a, b, c, callback) {
            callback(null, a + b + c);
        },
        thispChecker: function (callback) {
            callback(null, this === obj);
        },
        errorCallbacker: function (a, b, c, callback) {
            callback(exception);
        },
        errorThrower: function () {
            throw exception;
        }
    };

    describe("nfapply", function () {

        it("fulfills with callback result", function () {
            return Q.nfapply(function (a, b, c, callback) {
                callback(null, a + b + c);
            }, [1, 2, 3])
            .then(function (sum) {
                expect(sum).toEqual(6);
            });
        });

        it("rejects with callback error", function () {
            var exception = new Error("That is not your favorite color.");
            return Q.nfapply(function (a, b, c, callback) {
                callback(exception);
            }, [1, 2, 3])
            .then(function () {
                expect(true).toBe(false);
            }, function (_exception) {
                expect(_exception).toBe(exception);
            });
        });

    });

    describe("nfcall", function () {
        it("fulfills with callback result", function () {
            return Q.nfcall(function (a, b, c, callback) {
                callback(null, a + b + c);
            }, 1, 2, 3)
            .then(function (sum) {
                expect(sum).toEqual(6);
            });
        });

        it("rejects with callback error", function () {
            var exception = new Error("That is not your favorite color.");
            return Q.nfcall(function (a, b, c, callback) {
                callback(exception);
            }, 1, 2, 3)
            .then(function () {
                expect(true).toBe(false);
            }, function (_exception) {
                expect(_exception).toBe(exception);
            });
        });

    });

    describe("nfbind", function () {

        it("mixes partial application with complete application", function () {
            return Q.nfbind(function (a, b, c, d, callback) {
                callback(null, a + b + c + d);
            }, 1, 2).call({}, 3, 4)
            .then(function (ten) {
                expect(ten).toBe(10);
            });
        });

    });

    describe("nbind", function () {

        it("binds this, and mixes partial application with complete application", function () {
            return Q.nbind(function (a, b, c, callback) {
                callback(null, this + a + b + c);
            }, 1, 2).call(3 /* effectively ignored as fn bound to 1 */, 4, 5)
            .then(function (twelve) {
                expect(twelve).toBe(12);
            });
        });

        it("second arg binds this", function() {
            var expectedThis = { test: null };

            return Q.nbind(function(callback) {
                callback(null, this);
            }, expectedThis).call()
            .then(function(actualThis) {
                expect(actualThis).toEqual(expectedThis);
            });
        });

    });

	describe("npost", function () {

        it("fulfills with callback result", function () {
            return Q.npost(obj, "method", [1, 2, 3])
            .then(function (sum) {
                expect(sum).toEqual(6);
            });
        });

        it("gets the correct thisp", function () {
            return Q.npost(obj, "thispChecker", [])
            .then(function (result) {
                expect(result).toBe(true);
            });
        });

        it("rejects with callback error", function () {
            return Q.npost(obj, "errorCallbacker", [1, 2, 3])
            .then(function () {
                expect("blue").toBe("no, yellow!");
            }, function (_exception) {
                expect(_exception).toBe(exception);
            });
        });

        it("rejects with thrown error", function () {
            return Q.npost(obj, "errorThrower", [1, 2, 3])
            .then(function () {
                expect(true).toBe(false);
            }, function (_exception) {
                expect(_exception).toBe(exception);
            });
        });

        it("works on promises for objects with Node methods", function () {
            return Q(obj)
            .npost("method", [1, 2, 3])
            .then(function (sum) {
                expect(sum).toEqual(6);
            });
        });

    });

    describe("nsend", function () {

        it("fulfills with callback result", function () {
            return Q.nsend(obj, "method", 1, 2, 3)
            .then(function (sum) {
                expect(sum).toEqual(6);
            });
        });

        it("gets the correct thisp", function () {
            return Q.nsend(obj, "thispChecker")
            .then(function (result) {
                expect(result).toBe(true);
            });
        });

        it("rejects with callback error", function () {
            return Q.nsend(obj, "errorCallbacker", 1, 2, 3)
            .then(function () {
                expect("blue").toBe("no, yellow!");
            }, function (_exception) {
                expect(_exception).toBe(exception);
            });
        });

        it("rejects with thrown error", function () {
            return Q.nsend(obj, "errorThrower", 1, 2, 3)
            .then(function () {
                expect(true).toBe(false);
            }, function (_exception) {
                expect(_exception).toBe(exception);
            });
        });

        it("works on promises for objects with Node methods", function () {
            return Q(obj)
            .nsend("method", 1, 2, 3)
            .then(function (sum) {
                expect(sum).toEqual(6);
            });
        });

    });

    describe("deferred.makeNodeResolver", function () {

        it("fulfills a promise with a single callback argument", function () {
            var deferred = Q.defer();
            var callback = deferred.makeNodeResolver();
            callback(null, 10);
            return deferred.promise.then(function (value) {
                expect(value).toBe(10);
            });
        });

        it("fulfills a promise with multiple callback arguments", function () {
            var deferred = Q.defer();
            var callback = deferred.makeNodeResolver();
            callback(null, 10, 20);
            return deferred.promise.then(function (value) {
                expect(value).toEqual([10, 20]);
            });
        });

        it("rejects a promise", function () {
            var deferred = Q.defer();
            var callback = deferred.makeNodeResolver();
            var exception = new Error("Holy Exception of Anitoch");
            callback(exception);
            return deferred.promise.then(function () {
                expect(5).toBe(3);
            }, function (_exception) {
                expect(_exception).toBe(exception);
            });
        });

    });

    describe("nodeify", function () {

        it("calls back with a resolution", function () {
            var spy = jasmine.createSpy();
            Q(10).nodeify(spy);
            waitsFor(function () {
                return spy.argsForCall.length;
            });
            runs(function () {
                expect(spy.argsForCall).toEqual([[null, 10]]);
            });
        });

        it("calls back with an error", function () {
            var spy = jasmine.createSpy();
            Q.reject(10).nodeify(spy);
            waitsFor(function () {
                return spy.argsForCall.length;
            });
            runs(function () {
                expect(spy.argsForCall).toEqual([[10]]);
            });
        });

        it("forwards a promise", function () {
            return Q(10).nodeify().then(function (ten) {
                expect(ten).toBe(10);
            });
        });

    });

});

describe("browser support", function () {
    var _Q;

    beforeEach(function() {
        _Q = Q;
    });

    afterEach(function() {
        Q = _Q;
    });

    it("sets the global Q object to its original value", function() {
        if (typeof window !== 'undefined') {
            // If window is not undefined, the tests are running in the browser
            // assert that Q.noConflict returns window.Q to it's initial value
            // In this context the original value of Q is undefined
            Q.noConflict();
            expect(Q).toEqual(undefined);
        }
    });

    it("throws an error if Q.noConflict is called in node", function () {
        if (typeof window === 'undefined') {
            // If window is undefined the tests are being run in node, and
            // Q.noConflict should throw an error
            expect(Q.noConflict).toThrow();
        }
    });
});

describe("isPromise", function () {
    it("returns true if passed a promise", function () {
        expect(Q.isPromise(Q(10))).toBe(true);
    });

    it("returns false if not passed a promise", function () {
        expect(Q.isPromise(undefined)).toBe(false);
        expect(Q.isPromise(null)).toBe(false);
        expect(Q.isPromise(10)).toBe(false);
        expect(Q.isPromise("str")).toBe(false);
        expect(Q.isPromise("")).toBe(false);
        expect(Q.isPromise(true)).toBe(false);
        expect(Q.isPromise(false)).toBe(false);
        expect(Q.isPromise({})).toBe(false);
        expect(Q.isPromise({
            then: function () {}
        })).toBe(false);
        expect(Q.isPromise(function () {})).toBe(false);
    });
});

describe("isPromiseAlike", function () {
    it("returns true if passed a promise like object", function () {
        expect(Q.isPromiseAlike(Q(10))).toBe(true);
        expect(Q.isPromiseAlike({
            then: function () {}
        })).toBe(true);
    });

    it("returns false if not passed a promise like object", function () {
        expect(Q.isPromiseAlike(undefined)).toBe(false);
        expect(Q.isPromiseAlike(null)).toBe(false);
        expect(Q.isPromiseAlike(10)).toBe(false);
        expect(Q.isPromiseAlike("str")).toBe(false);
        expect(Q.isPromiseAlike("")).toBe(false);
        expect(Q.isPromiseAlike(true)).toBe(false);
        expect(Q.isPromiseAlike(false)).toBe(false);
        expect(Q.isPromiseAlike({})).toBe(false);
        expect(Q.isPromiseAlike(function () {})).toBe(false);
    });
});

if (typeof require === "function") {
    var domain;
    try {
        domain = require("domain");
    } catch (e) { }

    if (domain) {
        var EventEmitter = require("events").EventEmitter;

        describe("node domain support", function () {
            var d;

            beforeEach(function () {
                d = domain.create();
            });

            it("should work for non-promise async inside a promise handler",
               function (done) {
                var error = new Error("should be caught by the domain");

                d.run(function () {
                    Q().then(function () {
                        setTimeout(function () {
                            throw error;
                        }, 10);
                    });
                });

                var errorTimeout = setTimeout(function () {
                    done(new Error("Wasn't caught"));
                }, 100);

                d.on("error", function (theError) {
                    expect(theError).toBe(error);
                    clearTimeout(errorTimeout);
                    done();
                });
            });

            it("should transfer errors from `done` into the domain",
               function (done) {
                var error = new Error("should be caught by the domain");

                d.run(function () {
                    Q.reject(error).done();
                });

                var errorTimeout = setTimeout(function () {
                    done(new Error("Wasn't caught"));
                }, 100);

                d.on("error", function (theError) {
                    expect(theError).toBe(error);
                    clearTimeout(errorTimeout);
                    done();
                });
            });

            it("should take care of re-used event emitters", function (done) {
                // See discussion in https://github.com/kriskowal/q/issues/120
                var error = new Error("should be caught by the domain");

                var e = new EventEmitter();

                d.run(function () {
                    callAsync().done();
                });
                setTimeout(function () {
                    e.emit("beep");
                }, 100);

                var errorTimeout = setTimeout(function () {
                    done(new Error("Wasn't caught"));
                }, 500);

                d.on("error", function (theError) {
                    expect(theError).toBe(error);
                    clearTimeout(errorTimeout);
                    done();
                });

                function callAsync() {
                    var def = Q.defer();
                    e.once("beep", function () {
                        def.reject(error);
                    });
                    return def.promise;
                }
            });
        });
    }
}

describe("decorator functions", function () {
    describe("promised", function () {
        var exception = new Error("That is not the meaning of life.");
        it("resolves promised arguments", function () {
            var sum = Q.promised(function add(a, b) {
                return a + b;
            });
            return sum(Q(4), Q(5)).then(function (sum) {
                expect(sum).toEqual(9);
            });
        });
        it("resolves promised `this`", function () {
            var inc = Q.promised(function inc(a) {
                return this + a;
            });
            return inc.call(Q(4), Q(5)).then(function (sum) {
                expect(sum).toEqual(9);
            });
        });
        it("is rejected if an argument is rejected", function () {
            var sum = Q.promised(function add(a, b) {
                return a + b;
            });
            return sum(Q.reject(exception), Q(4)).then(function () {
                expect(4).toEqual(42);
            }, function (_exception) {
                expect(_exception).toBe(exception);
            });
        });
        it("is rejected if `this` is rejected", function () {
            var inc = Q.promised(function inc(a) {
                return this + a;
            });
            return inc.call(Q.reject(exception), Q(4)).then(function () {
                expect(4).toEqual(42);
            }, function (_exception) {
                expect(_exception).toBe(exception);
            });
        });
    });
});

describe("possible regressions", function () {

    describe("gh-9", function () {
        it("treats falsy values as resolved values without error", function () {
            expect(Q.isPending(null)).toEqual(false);
            expect(Q.isPending(void 0)).toEqual(false);
            expect(Q.isPending(false)).toEqual(false);
            expect(Q.isPending()).toEqual(false);
        });
    });

    describe("gh-22", function () {
        it("ensures that the array prototype is intact", function () {
            var keys = [];
            for (var key in []) {
                keys.push(key);
            }
            expect(keys.length).toBe(0);
        });
    });

    describe("gh-73", function () {
        it("does not choke on non-error rejection reasons", function () {
            Q.reject(REASON).done();

            var deferred = Q.defer();

            Q.onerror = function (error) {
                expect(error).toBe(REASON);
                deferred.resolve();
            };
            Q.delay(10).then(deferred.reject);

            return deferred.promise;
        });
    });

    describe("gh-90", function () {
        it("does not choke on rejection reasons with an undefined `stack`", function () {
            var error = new RangeError(REASON);
            error.stack = undefined;
            Q.reject(error).done();

            var deferred = Q.defer();

            Q.onerror = function (theError) {
                expect(theError).toBe(error);
                deferred.resolve();
            };
            Q.delay(10).then(deferred.reject);

            return deferred.promise;
        });
    });

});
