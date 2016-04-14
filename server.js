var ssbKeys      = require('ssb-keys')
var config       = require('ssb-config/inject')(process.env.ssb_appname)
var fs           = require('fs')
var path         = require('path')
var manifestFile = path.join(__dirname, 'manifest.json')
var pull = require('pull-stream')
var Serializer = require('pull-serializer')

var keys = ssbKeys.loadOrCreateSync(path.join(config.path, 'secret'))

var createSbot = require('scuttlebot')
  .use(require('scuttlebot/plugins/master'))
  .use(require('scuttlebot/plugins/gossip'))
  .use(require('scuttlebot/plugins/friends'))
  .use(require('scuttlebot/plugins/replicate'))
  .use(require('scuttlebot/plugins/blobs'))
  .use(require('scuttlebot/plugins/invite'))
  .use(require('scuttlebot/plugins/block'))
  .use(require('scuttlebot/plugins/local'))
  .use(require('scuttlebot/plugins/logging'))
  .use(require('scuttlebot/plugins/private'))
  .use(require('ssb-links'))
  .use(require('ssb-query'))
  .use(require('ssb-http'))

config.keys = keys
var sbot = createSbot(config)
fs.writeFileSync(manifestFile, JSON.stringify(sbot.getManifest(), null, 2))


var http = require('http')
var WS = require('pull-ws-server')
var MuxRpc = require('muxrpc')
var server = http.createServer(function (req, res) {
    fs.createReadStream(path.join(__dirname, 'static', 'index.html')).pipe(res)
  }).listen(8000)

WS.createServer({server: server}, function (ws) {
  console.log('RPC connection')
  var rpc = MuxRpc(sbot.getManifest(), sbot.getManifest(), Serializer)
    (sbot)

  pull(ws, pull.through(console.log), rpc.createStream(), pull.through(console.log), ws)
})

