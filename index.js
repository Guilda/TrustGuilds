var start = Date.now()

var observ = require('observable')
var pull = require('pull-stream')
var Scroll = require('pull-scroll')
var h = require('hyperscript')
var ssbc = require('ssb-client')
var markdown = require('ssb-markdown')
var Cat = require('pull-cat')

var Columns = require('column-deck')
var Stack = require('column-deck/stack')

var moment = require('moment')

var queries = require('./queries')

function px (n) { return n+'px' }

var dock = Columns({width: 600, margin: 20})

document.body.style.margin = px(0)
document.body.style.padding = px(0)

var lightbox = require('./lightbox')()
document.body.appendChild(lightbox)

var status = require('./status')()
document.body.appendChild(status)

document.body.appendChild(dock)

function click(name, action) {
  return h('a', {href: '#', onclick: action}, name)
}

function maxKey (obj) {
  var m
  for (var k in obj)
    m = (m == null ? k : obj[m] < obj[k] ? k : m)
  return m
}

function once (cont) {
  var ended = false
  return function (abort, cb) {
    if(abort) return cb(abort)
    else if (ended) return cb(ended)
    else
      cont(function (err, data) {
        if(err) return cb(ended = err)
        ended = true
        cb(null, data)
      })
  }
}

function first(stream, cb) {
  pull(stream, pull.find(cb))
}

function name (id) {
  var n = h('span', id.substring(0, 10))
  first(
    sbot.links2.read({query: [
      {$filter: {rel: ['mentions', {$prefix: '@'}], dest: id}},
      {$reduce: {
        $group: [['rel', 1]],
        $count: true
      }}
    ]}),
    function (err, names) {
      console.log('NAMES', names, err)
      if(err) throw err
      n.textContent = maxKey(names) || id.substring(0, 10)
    })

  return n
}

function stats (id) {
  var span = h('span')
  first(
    sbot.links2.read({query: [
      {$filter: {dest: id}},
      {$reduce: {$group: [['rel', 0]], $collect: 'source'}}
    ]}),
    function (err, feedback) {

      if(feedback.root)
        span.appendChild(h('div', 'replies:', feedback.root.map(name)))
      if(feedback.vote)
        span.appendChild(h('div', 'yup:', feedback.vote.map(name)))
    }
  )
  return span
}

function feedback (id) {
  var f = h('span')

  first(
    sbot.links2.read({query: [
      {$filter: {dest: id}},
      {$reduce: {$group: [['rel', 0]], $count: true}}
    ]}), function (err, feedback) {
        if(err || !feedback) return
        var s = []
        if(feedback.root) s.push('R:'+feedback.root)
        //this ignores that votes can be positive or negative.
        //they are nearly always positive.
        if(feedback.vote) s.push('Y:'+feedback.vote)
        if(feedback.mention) s.push('M:'+feedback.mention)
        f.textContent = s.join(' ')
    })

  status.hover(f, function () {
    return stats(id)
  })

  return f
}

var streams = {
  all: function () {
    return pull(sbot.createLogStream({reverse: true}), pull.through(console.log.bind(console)))
  },
  user: function (id) {
    return sbot.createUserStream({ id: id, reverse: true })
  },
  thread: function (root) {
    return pull(once(function (cb) {
        pull(
          Cat([
            once(function (cb) {
              sbot.get(root, function (err, value) {
                cb(err, {key: root, value: value})
              })
            }),
            sbot.links({rel: 'root', dest: root, values: true, keys: true})
          ]),
          pull.collect(cb)
        )
      }),
      //TODO: sort by cryptographic causal ordering.
      pull.map(function (ary) {
        return ary.sort(function (a, b) {
          return a.value.timestamp - b.value.timestamp
        })
      }),
      pull.flatten()
    )
  }
}

function render (data) {
  if(!data.value) throw new Error('data missing value property')
  return h('span', h('div.post',
    h('div.title',
      click(
        name(data.value.author),
        function () {
          createPanel(streams.user(data.value.author))
        }
      ),
      ' ',
      h('label', data.value.content.type || 'encrypted'),
      ' ',
      click(
        moment(data.value.timestamp).fromNow(),
        function () {
          createPanel(streams.thread(data.value.content.root || data.key))
        }
      )
    ),
    h('div', {
        style: {width: px(450), overflow: 'hidden'}
      },
      data.value.content.text ? (function () {
        var text = h('div')
        text.innerHTML = markdown.block(data.value.content.text, data.value.content.mentions)
        return text
      })() : h('pre', JSON.stringify(data.value.content))
    ),
    feedback(data.key)
  ), h('hr'))
}

function createPanel (stream) {
  var scroll = h('div', {
    style: {
      width: px(500),
      height: px(500), //MAGIC.
      margin: px(0),
      padding: px(0),
      overflow: 'scroll',
    }
  })

  var stack = Stack()
    .addFixed(h('h3', 'feed', {style: {background: 'grey'}},
      click('post', function () {
        var ta = h('textarea', {rows: 20, cols: 80})
        lightbox.show(h('span',
          ta,
          h('br'),
          click('cancel', lightbox.close),
          click('publish', function () {
            alert(ta.value)
          })
        ))
      }),
      click('close', function () {
        dock.remove(stack)
      })
    ))
    .addFitted(scroll)

  dock.add(stack)

  pull(
    stream,
    pull.filter(function (e) {
      if(!e.sync) return true
    }),
    Scroll(scroll, render, false, false)
  )

}

ssbc(function (err, _sbot) {
  if(err) {
    document.body.appendChild(
      ERR = h('pre', {style: {
        position: 'fixed', left: px(20), top: px(20)
      }}, err.stack)
    )
    return
  }
  console.log('connected...', Date.now() - start)
  sbot = _sbot
  createPanel(streams.all())
})


