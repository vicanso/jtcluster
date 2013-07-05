cluster = require 'cluster'

CHECK_TIMES = {}

CHECK_MSG = 'WORKER_CHECK'
HEALTHY_MSG = 'I AM HEALTHY'

noop = ->


jtCluster = 
  ###*
   * start 启动应用
   * @param  {[type]} @options [description]
   * @return {[type]}          [description]
  ###
  start : (@options = {}) ->
    if cluster.isMaster
      options.interval ?= 60 * 1000
      options.timeout ?= 10 * 1000
      options.failTimes ?= 5
      if options.masterHandler
        options.masterHandler()
      total = options.slaveTotal || require('os').cpus().length
      cluster.fork() for i in [0...total]
      @_initEvent()
    else
      @_slaveHandler()
    @
  _slaveHandler : ->
    error = @options?.error || noop
    slaveHandler = @options?.slaveHandler
    domain = require 'domain'
    if slaveHandler
      # 添加domain，用于捕获异常
      d = domain.create()
      d.on 'error', (err) ->
        error err
      d.run ->
        slaveHandler()
    process.on 'message', (msg) ->
      if msg == CHECK_MSG
        process.send HEALTHY_MSG
    @
  _msgHandler : (msg, pid) ->
    # 检测worker是否有响应healthy
    if msg == HEALTHY_MSG
      # 超过多长时间返回认为worker卡住
      if Date.now() - CHECK_TIMES[pid].now > @options.timeout
        CHECK_TIMES[pid].fail++
      else
        # 正常返回将fail置0
        CHECK_TIMES[pid].fail = 0
      CHECK_TIMES[pid].now = 0
      return @
    cmd = msg?.cmd
    if cmd
      func = ''
      if cmd == 'restart'
        func = 'disconnect'
      else if cmd == 'forcerestart'
        func = 'kill'
      @_do func, msg.timeout
    @
  _do : (func, timeout = 30000) ->
    beforeRestart = @options.beforeRestart
    # timeout时间之内如果worker没退出，强制kill
    forceKill = (worker) ->
      setTimeout ->
        if worker.state != 'dead'
          worker.kill()
      , timeout
    if func
      if beforeRestart
        beforeRestart (err) ->
          if !err
            Object.keys(cluster.workers).forEach (id) ->
              worker = cluster.workers[id]
              worker[func]()
              # 多长时间没退出直接使用kill
              if func != 'kill'
                forceKill worker
      else
        Object.keys(cluster.workers).forEach (id) ->
          worker = cluster.workers[id]
          worker[func]()
          if func != 'kill'
            forceKill worker
    @
  _initEvent : ->
    error = @options?.error || noop
    cluster.on 'exit', (worker) =>
      # 当有worker退出时，重新fork一个新的
      pid = worker.process.pid
      delete CHECK_TIMES[pid]
      error new Error "worker:#{pid} died!"
      worker = cluster.fork()
      # worker添加消息处理
      worker.on 'message', (msg) =>
        @_msgHandler msg, worker.process.pid
    Object.keys(cluster.workers).forEach (id) =>
      # 对当前的worker添加消息处理
      worker = cluster.workers[id]
      worker.on 'message', (msg) =>
        @_msgHandler msg, worker.process.pid
    cluster.on 'online', (worker) ->
      pid = worker.process.pid
      CHECK_TIMES[pid] = {fail : 0}
      console.info "worker:#{pid} is online!"
    setTimeout =>
      @_checkWorker()
    , @options.interval
    @
  _checkWorker : ->
    # 发送检测healthy的消息给worker, worker返回以判断worker是否卡住
    Object.keys(cluster.workers).forEach (id) =>
      worker = cluster.workers[id]
      pid = worker.process.pid
      # 若now未被置0证明在interval时间内，该worker未返回
      if CHECK_TIMES[pid].now
        CHECK_TIMES[pid].fail++
      if CHECK_TIMES[pid].fail >= @options.failTimes
        worker.kill()
      else
        CHECK_TIMES[pid].now = Date.now()
        worker.send CHECK_MSG
    setTimeout =>
      @_checkWorker()
    , @options.interval
    @

module.exports = jtCluster
