module.exports = (grunt) ->
  grunt.initConfig {
    coffee :
      node :
        expand : true
        cwd : 'src'
        src : ['**.coffee']
        dest : 'dest'
        ext : '.js'
  }

  grunt.loadNpmTasks 'grunt-contrib-coffee'
  grunt.loadNpmTasks 'grunt-contrib-clean'


  grunt.registerTask 'gen', ['coffee']