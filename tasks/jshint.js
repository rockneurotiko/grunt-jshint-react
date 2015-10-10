var rewire = require('rewire');
var proxyquire = require('proxyquire');

try {
    var babel = require('babel');
} catch (e) {
    throw new Error('grunt-jshint-react: The module `babel` was not found. ' +
                    'To fix this error run `npm install babel --save-dev`.', e);
}

var jshintcli = rewire('jshint/src/cli');

//Get the original lint function
var origLint = jshintcli.__get__('lint');

function endsWith(string, suffix) {
    return string.indexOf(suffix, string.length - suffix.length) !== -1;
}

function endsWithOneOf(string, suffixes) {
    for (var i = 0; i < suffixes.length; i++) {
        if (endsWith(string, suffixes[i])) {
            return true;
        }
    }

    return false;
}

//override the jshint cli in the grunt-contrib-jshint lib folder
var libJsHint = proxyquire('grunt-contrib-jshint/tasks/lib/jshint', {
    'jshint/src/cli': jshintcli
});


//insert the modified version of the jshint lib to the grunt-contrib-jshint taks
var gruntContribJshint = proxyquire('grunt-contrib-jshint/tasks/jshint', {
    './lib/jshint': libJsHint
});

//return the modified grunt-contrib-jshint version
module.exports = function (grunt) {
    var additionalSuffixes = grunt.config(['jshint', 'options', 'additionalSuffixes']) || [];

    var defaultSuffixes = ['.jsx', '.react.js'].concat(additionalSuffixes);
    var babelconf = grunt.config(['jshint', 'options', 'babelconf']) || undefined;
    //override the lint function to also transform the jsx code
    jshintcli.__set__('lint', function myLint(code, results, config, data, file) {
        var taskconf = config.babelconf || babelconf;
        delete config.babelconf;
        if (typeof taskconf !== "undefined")  {
            taskconf.whitelist = ["react"].concat(taskconf.whitelist || []);
        } else {
            taskconf = {whitelist: ["react"]};
        }
        //Remove the "additionalSuffixes" property to prevent
        //the "Bad option: 'additionalSuffixes'" error
        var taskSuffixis = defaultSuffixes.concat(config.additionalSuffixes || []);
        delete config.additionalSuffixes;
        var hasSuffix = endsWithOneOf(file, taskSuffixis);

        if (hasSuffix) {
            var compiled;

            try {
                compiled = babel.transform(code, taskconf).code;
            } catch (err) {
                throw new Error('grunt-jshint-react: Error while running JSXTransformer on ' + file + '\n' + err.message);
            }

            origLint(compiled, results, config, data, file);
        } else {
            origLint(code, results, config, data, file);
        }
    });

    return gruntContribJshint(grunt);
};
