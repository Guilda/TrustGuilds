var pull = require('pull-stream')
require('ssb-client')(function (err, sbot) {
  pull(sbot.query.read({
    query: [
      {$filter: {value: {content: {type: 'curation'}}}}
    ]
  }), pull.drain(console.log))
})
