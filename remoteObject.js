'use strict';

/**
 * Creates a new remote object instance.
 * @param methods the names of available methods
 * @param invoke a function that will be used to invoke remote methods
 * @param control an object to attach control functions to, allowing the
 * creator to have internal control over this remote object not available to
 * other clients
 * @type {{create: Function}}
 */
module.exports = {
	create: function(methods, invoke, control) {
		return new RemoteObject(methods, invoke, control);
	}
};

/**
 * An instance of a remote object.
 * @param methods the names of available methods
 * @param invoke a function that will be used to invoke remote methods
 * @param control an object to attach control functions to, allowing the
 * creator to have internal control over this remote object not available to
 * other clients
 * @returns {RemoteObject}
 * @constructor
 */
function RemoteObject(methods, invoke, control) {
	var self = this;

	var destroyed = false;

	// add provided methods
	methods.forEach(function(name) {
		self[name] = function() {
			// invoke via provided invoke function
			var args = Array.prototype.slice.call(arguments, 0);
			return invoke(name, args);
		};
	});

	// add event triggers
	var trigger = require('./trigger.js').create();
	self.on = trigger.on;
	self.off = trigger.off;

	// add a destroy method
	self.destroy = function() {
		if (!destroyed) {
			destroyed = true;
			trigger.fire('destroy');
		}
	};

	// add fire function to control object
	control.fire = trigger.fire;

	// add loss handler to control object
	control.onLoss = function() {
		destroyed = true;
		trigger.fire('loss');
		trigger.fire('destroy');
	};

	return this;
}
