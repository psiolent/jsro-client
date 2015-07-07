'use strict';

/**
 * Connections module establishes connections and provides an interface for
 * managing established connections.
 * @returns {{establish: Function}}
 */
module.exports = function() {
	return {
		establish: function(url, request, defer) {
			return request('GET', url).then(function(data) {
				if (typeof data.connectionID === 'undefined') {
					throw new Error('invalid response; expected connection ID');
				}
				return new Connection(url, request, defer, data.connectionID);
			});
		}
	};
};

/**
 * A connection to a JSRO-capable server.
 * @param url the base url on which to perform requests for this connection
 * @param request a function for performing http requests
 * @param defer a function for creating deferred promise instances
 * @param connectionID the ID of this connection
 * @constructor
 */
function Connection(url, request, defer, connectionID) {
	var self = this;

	// ID to use for the next request
	var nextRequestID = 0;

	// keep track of whether we have a request outstanding
	var requesting = false;

	// queue pending requests while there is a request outstanding
	var requestQueue = [];

	// index request handlers by request ID
	var handlers = {};

	self.create = function(name, spec) {

	};


	return this;
}
