var ssbKeys      = require('ssb-keys')
var config       = require('ssb-config/inject')(process.env.ssb_appname)
var fs           = require('fs')
var path         = require('path')
var manifestFile = path.join(config.path, 'manifest.json')

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
  .use(require('ssb-http'))

config.keys = keys
var server = createSbot(config)
fs.writeFileSync(manifestFile, JSON.stringify(server.getManifest(), null, 2))



