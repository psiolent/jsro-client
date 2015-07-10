'use strict';

module.exports.create = function(url, request, callback) {
	return new Poller(url, request, callback);
};

function Poller(url, request, callback) {
	var self = this;

	self.stop = function() {
		// todo
	};

	// todo

	return this;
}
