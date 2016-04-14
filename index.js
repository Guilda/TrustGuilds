var start = Date.now()
var defer = require('pull-defer')
var observ = require('observable')
var pull = require('pull-stream')
var Scroll = require('pull-scroll')
var h = require('hyperscript')
var ssbc = require('ssb-client')
var markdown = require('ssb-markdown')
var Cat = require('pull-cat')
var mentions = require('ssb-mentions')

var suggest = require('suggest-box')

var Columns = require('column-deck')
var Stack = require('column-deck/stack')

var moment = require('moment')
var jade = require('jade')

function px (n) { return n+'px' }

var dock = Columns({width: 600, margin: 20})

document.body.style.margin = px(0)
document.body.style.padding = px(0)

document.body.appendChild(h('style', '.selected { color: red };'))

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
  //choose the most popular name for this person.
  //for anything like this you'll see I have used sbot.links2
  //which is the ssb-links plugin. as you'll see the query interface
  //is pretty powerful!
  //TODO: "most popular" name is easily gameable.
  //must come up with something better than this.
  first(
    sbot.links2.read({query: [
      {$filter: {rel: ['mentions', {$prefix: '@'}], dest: id}},
      {$reduce: {
        $group: [['rel', 1]],
        $count: true
      }}
    ]}),
    function (err, names) {
      if(err) throw err
      n.textContent = maxKey(names) || id.substring(0, 10)
    })

  return n
}

//show how many people have voted, replied, or mentioned this message.
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

function toggle(off, on, change) {
  var state = false
  var a = h('a', {href: '#', onclick: function () {
    state = !state
    a.innerText = state ? on : off
    change(state)
  }}, off)
  change(state)
  return a
}

var streams = {
  all: function () {
    return sbot.createLogStream({reverse: true})
  },
  user: function (id) {
    return sbot.createUserStream({ id: id, reverse: true })
  },
  thread: function (root) {
    //in this case, it's inconvienent that panel only takes
    //a stream. maybe it would be better to accept an array?
    var source = defer.source()
    pull(
      Cat([
        once(function (cb) {
          sbot.get(root, function (err, value) {
            cb(err, {key: root, value: value})
          })
        }),
        sbot.links({rel: 'root', dest: root, values: true, keys: true})
      ]),
      pull.collect(function (err, thread) {
        thread.sort(function (a, b) {
          //THIS IS WRONG AND HAS KNOWN BUGS!!!
          //TODO: sort by cryptographic causal ordering.
          return a.value.timestamp - b.value.timestamp
        })
        console.log(thread)
        source.resolve(pull.values(thread))
      })
    )

    return source
  }
}


// With this data, render the given template at path
function renderWithTemplate(data, template_path){
  var rendered_page = jade.renderFile(template_path, { self: data });
  var new_page_element = document.createElement('div')

  new_page_element.innerHTML = rendered_page;

  return new_page_element;
}

function render (data) {
  if(!data.value) throw new Error('data missing value property')

  return renderWithTemplate(data, "view/post.jade")

  // return h('span', h('div.post',
  //   h('div.title',
  //     click(
  //       name(data.value.author),
  //       function () {
  //         createPanel(streams.user(data.value.author))
  //       }
  //     ),
  //     ' ',
  //     h('label', data.value.content.type || 'encrypted'),
  //     ' ',
  //     click(
  //       moment(data.value.timestamp).fromNow(),
  //       function () {
  //         createPanel(streams.thread(data.value.content.root || data.key))
  //       }
  //     )
  //   ),
  //   h('div', {
  //       style: {width: px(450), overflow: 'hidden'}
  //     },
  //     data.value.content.text ? (function () {
  //       var text = h('div')
  //       text.innerHTML = markdown.block(data.value.content.text, data.value.content.mentions)
  //       return text
  //     })() : h('pre', JSON.stringify(data.value.content))
  //   ),
  //   feedback(data.key)
  // ), h('hr'))
}

//create a panel (column) from a stream of messages.
//a stream has several advantages, for example,
//messages that don't need to be displayed yet won't
//be rendered, so it's gentler on the database.
//
//it's probably not ideal to just treat everything
//as a scolling column, for example, on a user feed
//we should show some "profile" information at the top.
//
//and for a thread, we want a composer to appear at the _bottom_
//(after you have read the whole thread)
//
//but the best thing about just making it a stream,
//is that I want to make a column be a rendering of any database query.
//(TODO, expand on the patterns in ssb-links)

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
      //UGLY: it's really ugly that I put the whole composer
      //just inline like this. this should really be refactored
      //out completely. maybe into it's own repo?
      //I don't have support for thread replies yet.
      //those would need to be more coupled to the messages in the
      //thread because they would need to get the most recent message
      //for the branch link.
      click('post', function () {
        var ta = h('textarea', {rows: 20, cols: 80})
        var prev = h('span')

        var tog
        lightbox.show(h('span',
          tog = h('div', ta),
          h('br'),
          click('cancel', lightbox.close),
          ' ',
          toggle('preview', 'edit', function (state) {
            tog.innerHTML = ''
            if(!state) tog.appendChild(ta)
            else {
              prev.innerHTML = markdown.block(ta.value)
              tog.appendChild(prev)
            }
            lightbox.center()
          }),

          click('publish', function () {
            var content = {type: 'post', text: ta.value, mentions: mentions(ta.value)}
            sbot.publish(content, function (err, msg) {
              alert('published: '+ msg.key || JSON.stringify(msg))
              lightbox.close()
            })
          })
        ))

        suggest(ta, function (word, cb) {
          if(!/^[@%&!]/.test(word[0])) return cb()
          if(word.length < 2) return cb()

          var sigil = word[0]
          var embed = ((sigil === '!') ? '!' : '')
          if(embed) sigil = '&'
          if(word[0] !== '@') word = word.substring(1)

          first(
            sbot.links2.read({query: [
              {$filter: {rel: ['mentions', {$prefix: word}], dest: {$prefix: sigil}}},
              {$reduce: {$group: [['rel', 1], 'dest'], $count: true}}
            ]}),
            function (err, names) {
              var ary = []
              for(var name in names)
                for(var id in names[name])
                  ary.push({name: name, id: id, count: names[name][id]})

              ary = ary
              .filter(function (e) {
                if(!embed) return true
                return /\.(gif|jpg|png|svg)$/i.test(e.name)
              }).sort(function (a, b) {
                return b.count - a.count
              }).map(function (e) {
                return {
                  title: e.name + ': ' + e.id.substring(0,10)+' ('+e.count+')',
                  value: embed+'['+e.name+']('+e.id+')'
                }
              })

              cb(null, ary)
            }
          )
        })
      }),
      ' ',
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
