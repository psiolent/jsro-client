'use strict';

/**
 * A functionality context for operating within Angular.
 * @param $http the Angular HTTP service
 * @param $timeout the Angular timeout service
 * @param $q the Angular promises service
 * @constructor
 */
function Context($http, $timeout, $q) {
	/**
	 * Performs an HTTP request.
	 * @param method the request method, e.g. 'GET', 'POST', etc.
	 * @param url the url of the JSRO server
	 * @param [data] optional data to send with the request
     * @returns {promise} a promise for the request result; the promise
	 * will also have a function property, 'abort' which will cause
	 * the request to be aborted
     */
	this.request = function(method, url, data) {
		// configure the request
		var deferredTimeout = $q.defer();
		var requestConfig = {
			method: method,
			url: url,
			timeout: deferredTimeout.promise
		};
		if (data) {
			requestConfig.data = data;
		}

		// perform the request
		var requestPromise = $http(requestConfig).then(function(response) {
			return response.data;
		});

		// add an abort function to the request promise
		requestPromise.abort = deferredTimeout.resolve;

		return requestPromise;
	};

	/**
	 * Schedules a function to be called after the specified delay.
	 * @param fn the callback function
	 * @param delay the delay in milliseconds
	 * @returns {*} a token which can be passed to clearTimeout()
	 * to cancel the timeout
     */
	this.setTimeout = function(fn, delay) {
		return $timeout(fn, delay);
	};

	/**
	 * Cancels a previously scheduled timeout.
	 * @param token a token provided by a call to setTimeout()
     */
	this.clearTimeout = function(token) {
		$timeout.cancel(token);
	};

	/**
	 * Creates and returns a deferred promise object.
     */
	this.defer = $q.defer;

	return this;
}

// register the jsro angular module and service
angular.module('jsro', []).factory('jsroService', [
	'$http',
	'$timeout',
	'$q',
	function($http, $timeout, $q) {
		// create context
		var context = new Context($http, $timeout, $q);

		// going to need connection module
		var connection = require('./connection.js');

		/**
		 * Creates a connection to a JSRO server.
		 * @param url the url of the JSRO server
		 * @param [pollTimeout] the poll timeout in milliseconds; if a poll
		 * request has not received a response in this amount of time, a
		 * new poll request will be issued
         * @returns {promise} a promise for a connection to the JSRO server
         */
		function connect(url, pollTimeout) {
			return connection.establish(url, context, pollTimeout);
		}

		// provide the connect function
		return connect;
	}
]);
