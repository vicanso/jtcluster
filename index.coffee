cluster = require 'cluster'
domain = require 'domain'
noop = ->

jtCluster = 
  ###*
   * start 启动应用
   * @param  {[type]} @options [description]
   * @return {[type]}          [description]
  ###
  start : (@options) ->
    if cluster.isMaster
      if options.masterHandler
        options.masterHandler()
      total = options.slaveTotal || require('os').cpus().length
      cluster.fork() for i in [0...total]
      @_initEvent()
    else
      @_slaveHandler()
  _slaveHandler : ->
    error = @options?.error || noop
    slaveHandler = @options?.slaveHandler
    if slaveHandler
      d = domain.create()
      d.on 'error', (err) ->
        error err
      d.run ->
        slaveHandler()
  _msgHandler : (msg) ->
    if msg?.cmd == 'restart'
      if @options.beforeRestart
        @options.beforeRestart (err) ->
          if !err
            Object.keys(cluster.workers).forEach (id) ->
              cluster.workers[id].disconnect()
      else
        Object.keys(cluster.workers).forEach (id) ->
          cluster.workers[id].disconnect()
  _initEvent : ->
    error = @options?.error || noop
    cluster.on 'exit', (worker) =>
      error new Error "worker:#{worker.process.pid} died!"
      worker = cluster.fork()
      worker.on 'message', (msg) =>
        @_msgHandler msg
    Object.keys(cluster.workers).forEach (id) =>
      cluster.workers[id].on 'message', (msg) =>
        @_msgHandler msg
    cluster.on 'online', (worker) ->
      console.info "worker:#{worker.process.pid} is online!"
module.exports = jtCluster
