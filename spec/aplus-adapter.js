"use strict";

var Q = require("../lib/q").default;
Q.stopUnhandledRejectionTracking();

exports.fulfilled = Q.resolve;
exports.rejected = Q.reject;
exports.pending = function () {
    var deferred = Q.defer();

    return {
        promise: deferred.promise,
        fulfill: deferred.resolve.bind(deferred),
        reject: deferred.reject.bind(deferred)
    };
};
