'use strict';

/**
 * Uses the Angular $http service to create the expected request function.
 * @param $http the Angular HTTP service
 * @param $q the Angular promises service
 * @returns {Function}
 */
function createRequestFunction($http, $q) {
	function request(method, url, data) {
		// configure the request
		var requestConfig = {
			method: method,
			url: url,
			timeout: $q.defer
		};
		if (data) {
			requestConfig.data = data;
		}

		// perform the request
		var requestPromise = $http(requestConfig).then(function(response) {
			return JSON.parse(response.data);
		});

		// add an abort function to the request promise
		requestPromise.abort = requestConfig.timeout.resolve;

		return requestPromise;
	}

	return request;
}

// register the jsro angular module and service
angular.module('jsro', []).factory('jsroService', [
	'$http',
	'$q',
	function($http, $q) {
		// create request and defer functions
		var request = createRequestFunction($http, $q);
		var defer = $q.defer;

		// going to need connection module
		var connection = require('./connection.js');

		// provide an api object with a connect function
		return {
			connect: function(url) {
				return connection.establish(url, request, defer);
			}
		};
	}
]);
