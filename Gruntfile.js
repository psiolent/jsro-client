module.exports = function(grunt) {
	'use strict';

	var pkg = grunt.file.readJSON('package.json');

	grunt.initConfig({
		browserify: {
			angular: {
				src: 'angular-main.js',
				dest: 'dist/jsro-angular-' + pkg.version + '.js'
			}
		},
		jshint: {
			files: ['*.js'],
			options: {
				jshintrc: true
			}
		},
		simplemocha: {
			all: {
				src: ['tests/*.js']
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-simple-mocha');
	grunt.loadNpmTasks('grunt-browserify');

	grunt.registerTask('test', ['jshint', 'simplemocha']);
	grunt.registerTask('default', ['jshint', 'simplemocha', 'browserify']);
};
