module.exports = function(grunt) {
	'use strict';

	grunt.initConfig({
		jshint: {
			files: ['*.js'],
			options: {
				jshintrc: true
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-jshint');

	grunt.registerTask('test', ['jshint']);
	grunt.registerTask('default', ['jshint']);
};
