'use strict';

/**
 * Creates and returns a new request queue instance.
 * @param context a functionality context allowing the JSRO library to operate
 * in whatever environment it is deployed in
 * @returns {RequestQueue}
 */
module.exports.create = function(context) {
	return new RequestQueue(context);
};

/**
 * Manages a queue of pending requests and their results.
 * @param context a functionality context allowing the JSRO library to operate
 * in whatever environment it is deployed in
 * @returns {RequestQueue}
 * @constructor
 */
function RequestQueue(context) {
	var self = this;

	// ID to use for the next request
	var nextRequestID = 0;

	// queue pending requests while there is a request outstanding
	var requestQueue = [];

	// deferred request results by request ID
	var deferredResults = [];

	/**
	 * Adds a request to the queue. The provided object will have a requestID
	 * property added and will be placed in the queue as-is.
	 * @param request the request to add to this queue
	 * @returns {promise}
	 */
	self.add = function(request) {
		// create request ID and deferred result for this request
		var deferredResult = context.defer();
		var requestID = nextRequestID++;

		// add request ID to request
		request.requestID = requestID;

		// index deferred result
		deferredResults[requestID] = deferredResult;

		// queue up the request
		requestQueue.push(request);

		// return the promise for the result
		return deferredResult.promise;
	};

	/**
	 * Drains all requests from this queue. The request queue will be empty
	 * after calling this function.
	 * @returns {Array} the requests that were in this queue
	 */
	self.drain = function() {
		var requests = requestQueue;
		requestQueue = [];
		return requests;
	};

	/**
	 * Handles the result of a request by resolving (or rejecting) the
	 * deferred result returned when the corresponding request was added to this
	 * queue.
	 * @param result the received result of a request
	 */
	self.handleResult = function(result) {
		// save request ID and remove it from result
		var requestID = result.requestID;
		delete result.requestID;

		// get its deferred result
		var deferredResult = deferredResults[requestID];

		if (deferredResult) {
			if (result.error) {
				// reject the deferred result with the error
				deferredResult.reject(result.error);
			} else {
				// resolve the deferred result with the result
				deferredResult.resolve(result);
			}
			delete deferredResults[requestID];
		}
	};

	return this;
}
