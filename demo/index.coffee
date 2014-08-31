JTCluster = require '../dest/index'

options = 
  # 检测的时间间隔
  interval : 10 * 1000
  # worker检测的超时值
  timeout : 5 * 1000
  # 连续失败多少次后重启
  failTimes : 5
  # 子进程的个数
  slaveTotal : 3
  restartOnError : true
  slaveHandler : ->
    http = require 'http'
    server = http.createServer (req, res) ->
      if req.url == '/restart'
        process.send {
          cmd : 'jt_restart'
          timeout : 30000
        }
      if req.url == '/restartall'
        process.send {
          cmd : 'jt_restartall'
          timeout : 30000
        }
      else if req.url == '/kill'
        process.send {cmd : 'jt_kill'}
      else if req.url == '/fullrun'
        setTimeout ->
          while true
            j = 0
          return
        , 100
      else if req.url == '/error'
        throw new Error 'throw error'
      res.writeHead 200
      res.end 'hello world'
    port = 10000
    server.listen port
    console.dir "listen on #{port}"
    setTimeout ->
      console.dir process._jtPid
    , 1000
  beforeRestart : (cbf) ->
    #do some before restart
    setTimeout ->
      cbf null
    , 10000


jtCluster = new JTCluster options

jtCluster.on 'log', (data) ->
  console.dir data
