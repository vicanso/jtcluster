cluster = require 'cluster'
events = require 'events'
CHECK_TIMES = {}

CHECK_MSG = 'WORKER_CHECK'
HEALTHY_MSG = 'I AM HEALTHY'
SET_JT_PID_MSG = 'SET JT PID'

noop = ->


class JTCluster extends events.EventEmitter
  ###*
   * start 启动应用
   * @param  {[type]} @options [description]
   * @return {[type]}          [description]
  ###
  start : (@options = {}) ->
    if cluster.isMaster
      options.interval ?= 10 * 1000
      options.timeout ?= 10 * 1000
      options.failTimes ?= 5
      if options.masterHandler
        options.masterHandler()
      total = options.slaveTotal || require('os').cpus().length
      total = 1 if total < 1
      for i in [0...total]
        childProcess = cluster.fork()
        childProcess._jtPid = i
        # console.dir childProcess
      @_initEvent()
      Object.keys(cluster.workers).forEach (id) =>
        worker = cluster.workers[id]
        worker.send {msg : SET_JT_PID_MSG, _jtPid : worker._jtPid}
    else
      @_slaveHandler()
    @
  ###*
   * _slaveHandler slave的执行函数
   * @return {[type]} [description]
  ###
  _slaveHandler : ->
    # error = @options.error || noop
    restartOnError = @options.restartOnError
    slaveHandler = @options.slaveHandler
    domain = require 'domain'
    if slaveHandler
      # 添加domain，用于捕获异常
      d = domain.create()
      d.on 'error', (err) =>
        params = 
          pid : process.pid
          _jtPid : process._jtPid
          err : err.toString()
          stack : err.stack
        @emit 'log', {
          category : 'uncaughtException'
          params : JSON.stringify params
          date : new Date
        }
        # error err
        if restartOnError
          setTimeout ->
            process.exit 1
          , 30000
          cluster.worker.disconnect()
      d.run ->
        slaveHandler()
    process.on 'message', (msg) ->
      if msg == CHECK_MSG
        process.send HEALTHY_MSG
      else if msg?.msg == SET_JT_PID_MSG
        process._jtPid = msg._jtPid
    @
  ###*
   * _msgHandler 消息处理
   * @param  {[type]} msg [description]
   * @param  {[type]} pid [description]
   * @return {[type]}     [description]
  ###
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
      if cmd == 'jt_restart'
        func = 'disconnect'
      else if cmd == 'jt_restartall'
        func = 'disconnect'
        pid = null
      else if cmd == 'jt_kill'
        func = 'kill'
      else if cmd == 'jt_killall'
        func = 'kill'
        pid = null
      @_do func, pid
    @
  ###*
   * _do 执行message中的命令
   * @param  {[type]} func    [description]
   * @param  {[type]} pid [description]
   * @return {[type]}         [description]
  ###
  _do : (func, pid) ->
    beforeRestart = @options.beforeRestart
    # timeout时间之内如果worker没退出，强制kill
    forceKill = (worker) ->
      setTimeout ->
        if worker.state != 'dead'
          worker.kill()
      , 30000
    restart = (worker, pid) ->
      if pid
        if worker.process.pid == pid
          worker[func]()
          # 多长时间没退出直接使用kill
          if func != 'kill'
            forceKill worker
      else
        worker[func]()
        # 多长时间没退出直接使用kill
        if func != 'kill'
          forceKill worker
    if func
      if beforeRestart
        beforeRestart (err) ->
          if !err
            Object.keys(cluster.workers).forEach (id) ->
              worker = cluster.workers[id]
              restart worker, pid
      else
        Object.keys(cluster.workers).forEach (id) ->
          worker = cluster.workers[id]
          restart worker, pid
    @
  ###*
   * _initEvent 初始化事件，消息的处理
   * @return {[type]} [description]
  ###
  _initEvent : ->
    # error = @options?.error || noop
    cluster.on 'exit', (worker) =>
      # 当有worker退出时，重新fork一个新的
      pid = worker.process.pid
      delete CHECK_TIMES[pid]
      _jtPid = worker._jtPid
      params = 
        pid : pid
        _jtPid : _jtPid
      @emit 'log', {
        category : 'exit'
        params : JSON.stringify params
        date : new Date()
      }
      worker = cluster.fork()
      # worker添加消息处理
      worker.on 'message', (msg) =>
        @_msgHandler msg, worker.process.pid
      worker._jtPid = _jtPid
      worker.send {msg : SET_JT_PID_MSG, _jtPid : _jtPid}
    Object.keys(cluster.workers).forEach (id) =>
      # 对当前的worker添加消息处理
      worker = cluster.workers[id]
      worker.on 'message', (msg) =>
        @_msgHandler msg, worker.process.pid
    cluster.on 'online', (worker) =>
      pid = worker.process.pid
      CHECK_TIMES[pid] = {fail : 0}
      params = 
        pid : pid
        _jtPid : worker._jtPid
      @emit 'log', {
        category : 'online'
        params : JSON.stringify params
        date : new Date
      }
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
        params = 
          pid : pid
          _jtPid : worker._jtPid
        @emit 'log', {
          category : 'toobusy'
          params : JSON.stringify params
          date : new Date
        }
        worker.kill()
      else
        CHECK_TIMES[pid].now = Date.now()
        worker.send CHECK_MSG
    setTimeout =>
      @_checkWorker()
    , @options.interval
    @

module.exports = JTCluster
