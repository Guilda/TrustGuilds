

var msgs = require('ssb-msgs')
require('ssb-client')(function (err, sbot) {
var data = require('./curation.json')

  sbot.publish(data, function (err, msg) {
    console.log(msg)
    console.log(msgs.links(msg))
    msgs.indexLinks(msg, console.log)
  })
  //sbot.get("%Kh3bLQHjSCymk7vrvaoM5BWaG5G2X3f0bWaMpyEhabo=.sha256",
  //function (err, msg) {
  //})
})





