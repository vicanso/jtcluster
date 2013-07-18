jtCluster = require '../index'
options = 
  # 检测的时间间隔
  interval : 60 * 1000
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
          cmd : 'restart'
          timeout : 30000
        }
      else if req.url == '/forcerestart'
        process.send {cmd : 'forcerestart'}
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
    port = 8080
    server.listen port
    console.dir "listen on #{port}"
  error : (err) ->
    console.dir err.stack
  beforeRestart : (cbf) ->
    #do some before restart
    setTimeout ->
      cbf null
    , 10000

jtCluster.start options

