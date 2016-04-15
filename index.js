var MuxRpc = require('muxrpc')
var Serializer = require('pull-serializer')
var WS = require('pull-ws-server/client')

var ref = require('ssb-ref')

var isMsg = ref.isMsg

var start = Date.now()
var defer = require('pull-defer')
var observ = require('observable')
var pull = require('pull-stream')
var Scroll = require('pull-scroll')
var h = require('hyperscript')
//var ssbc = require('ssb-client')
var markdown = require('ssb-markdown')
var Cat = require('pull-cat')
var mentions = require('ssb-mentions')

var fs = require('fs')
var path = require('path')

var API = require('./api')

var suggest = require('suggest-box')
var Stack = require('column-deck/stack')

var moment = require('moment')
var jade = require('jade')

var validation = require('./validation')

function px (n) { return n+'px' }

var view = {
  layout: jade.compile(fs.readFileSync(path.join(__dirname, 'view', 'layout.jade'))),
  post: jade.compile(fs.readFileSync(path.join(__dirname, 'view', 'post.jade'))),
  person: jade.compile(fs.readFileSync(path.join(__dirname, 'view', 'person.jade')))
}

// With this data, render the given template at path
function Jade (data, template){
  var new_page_element = document.createElement('span')
  new_page_element.innerHTML = template(data);
  return new_page_element;
}

// Setup per page render stuff
function setup_page()
{
  chunks = location.hash.split("/")

  var type = chunks[0]
  var singular = decodeURIComponent(chunks[1])

  if(type === "")
  {
    render_feed()
  }
  else if(type === "#t")
  {
    render_tag(singular);
  }
  else if (type === "#u") {
    render_person(singular);
  }


  names = document.getElementsByClassName('name')
  var i;
  for (i = 0; i < names.length; i++) {
    console.log(names[i])
    var text_content = names[i].textContent

    console.log(name(text_content))

    names[i].innerHTML = ""
    names[i].appendChild( name(text_content) )
  }

}

document.body.appendChild(h('style', '.selected {color: red}'))

// Sketchy path routing of doom, BEGINS
if ("onhashchange" in window) {
  window.onhashchange = function(){
    setup_page()
  }
}

function render_feed()
{
  render_to_panel(streams.all())
}

function render_tag(tag)
{
  render_to_panel(streams.curations_for_tags(tag))
}

function render_person(person)
{
  render_to_panel(streams.user(person), person)
}

// Helper to render stuff in a stream to a panel
function render_to_panel(stuff, person)
{
  var content = document.body.querySelector('#content')
  content.innerHTML = ""

  createPanel(content, stuff, person)
}


document.body.appendChild(h('style', '.selected { color: red };'))

var lightbox = require('./lightbox')()
document.body.appendChild(lightbox)

var status = require('./status')()
document.body.appendChild(status)

function click(name, action, class_names) {
  return h('a', {href: '#', onclick: action, className: class_names}, name)
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

function max (ary, map) {
  return ary.reduce(function (a, b) {
    return map(b) > map(a) ? b : a
  })
}

function name (id) {
  var n = h('span', id.substring(0, 10))
  //choose the most popular name for this person.
  //for anything like this you'll see I have used sbot.links2
  //which is the ssb-links plugin. as you'll see the query interface
  //is pretty powerful!
  //TODO: "most popular" name is easily gameable.
  //must come up with something better than this.
  pull(
    sbot.links2.read({query: [
      {$filter: {rel: ['mentions', {$prefix: '@'}], dest: id}},
      {$reduce: {
        name: ['rel', 1],
        count: {$count: true}
      }}
    ]}),
    pull.collect(function (err, names) {
      console.log(err, names)
      if(err) throw err
      var pref = max(names, function (e) { return e.count })
      console.log(names, pref)
      pref = pref && pref.name || pref
      n.textContent = pref || id.substring(0, 10)
    })
  )



  return n
}

//show how many people have voted, replied, or mentioned this message.
function stats (id) {
  var span = h('span')
  first(
    sbot.links2.read({query: [
      {$filter: {dest: id}},
      {$reduce: {$group: [['rel', 0]], $reduce: {$collect: 'source'}}}
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
      {$reduce: {$group: [['rel', 0]],$reduce: {$count: true}}}
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
  var a = h('a', {className: "btn btn-default", href: '#', onclick: function () {
    state = !state
    a.innerText = state ? on : off
    change(state)
  }}, off)
  change(state)
  return a
}

var streams = {
  all: function () {
    return API(sbot).curations()
  },
  curations_for_tags: function (tags) {
    return API(sbot).curations(tags)
  },
  user: function (id) {
    return sbot.createUserStream({ id: id, reverse: true })
  },
  tags: function () {
    return API(sbot).tags()
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

function render (data) {
  if(!data.value) throw new Error('data missing value property')
  return Jade({ data: data, moment: moment }, view.post)
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

function createPanel (el, stream, user) {
  var scroll = h('div', {
    style: {
      height: '100%', //MAGIC.
      overflow: 'scroll'
    }
  })

  el.innerHTML = ''

  if(user) {
    el.appendChild(
      h('div').innerHTML = Jade({ data: user, moment: moment }, view.person)
    )
  }

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
        var url, credit, title, rating, one_liner, summary, tags
        var prev = h('span')

        var form = h('form',
          h('div', {className: 'form-group'}),
          h('label', "url",
            url = h('input', {type: 'text', className: "form-control"})),
          h('label', "credit",
            credit = h('input', {type: 'text', className: "form-control"})),
          h('label', "title",
            title = h('input', {type: 'text', className: "form-control"})),
          h('label', "rating",
            rating = h('input', {type: 'text', className: "form-control"})),
          h('label', "one liner",
            one_liner = h('textarea', {rows: 2, cols: 80, className: "form-control"})),
          h('label', "summary",
            summary = h('textarea', {rows: 20, cols: 80, className: "form-control"})),
          h('label', "tags",
            tags = h('input', {type: 'text', className: "form-control"}))
        )

        var tog
        lightbox.show(h('span',
          tog = h('div', form),
          h('br'),
          click('cancel', lightbox.close, 'btn btn-warning'),
          ' ',
          toggle('preview', 'edit', function (state) {
            tog.innerHTML = ''
            if(!state){
              tog.appendChild(form)
            }
            else {
              prev.innerHTML = markdown.block(summary.value)
              tog.appendChild(prev)
            }
            lightbox.center()
          }, 'btn btn-default'),

          click('publish', function () {

            // If valid, publish this curation

            if(isMsg(url.value) && !credit.value)
              sbot.get(url.value, function (err, msg) {
                console.log(msg)
                if(err)
                  return alert('could not retrive msg:'+url.value)
                credit.value = msg.author
                publish()
              })
            else
              publish()

            function publish () {

              var content = {
                type: 'curation',
                curate: url.value,
                credit: credit.value,
                title: title.value,
                oneLiner: one_liner.value,
                summary: summary.value,
                mentions: mentions(summary.value),
                tags: tags.value.split(" "),
                rating: parseFloat(rating.value)
              }

              // If valid, publish this curation
              try {
                validation.curation(content)

                sbot.publish(content, function (err, msg) {
                  alert('published: '+ msg.key || JSON.stringify(msg))
                  lightbox.close()
                })
              }
              catch(e) {
                alert(e);
              }

            }
          }, 'btn btn-success')
        ))

        suggest(summary, function (word, cb) {
          if(!/^[@%&!]/.test(word[0])) return cb()
          if(word.length < 2) return cb()

          var sigil = word[0]
          var embed = ((sigil === '!') ? '!' : '')
          if(embed) sigil = '&'
          if(word[0] !== '@') word = word.substring(1)

          pull(
            sbot.links2.read({query: [
              {$filter: {rel: ['mentions', {$prefix: word}], dest: {$prefix: sigil}}},
              {$reduce:
                  {name: ['rel', 1], id: 'dest', count: {$count: true}}
//                $group: [['rel', 1], 'dest'], $reduce: {$count: true}}
              }
            ]}),
            pull.collect(function (err, ary) {
  //            var ary = []
//              for(var name in names)
//                for(var id in names[name])
//                  ary.push({name: name, id: id, count: names[name][id]})
//
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

          console.log('array', ary)

              cb(null, ary)
            })
          )
        })
      })
    ))
    .addFitted(scroll)

    el.appendChild(stack)

  pull(
    stream,
    pull.filter(function (e) {
      if(!e.sync) return true
    }),
    Scroll(scroll, render, false, false)
  )

}

require('./reconnect')(function (cb) {
  var ws = WS.connect('ws://localhost:8000/')
  sbot = window.CLIENT =
    MuxRpc(require('./manifest.json'), null, Serializer)()

  pull(ws, sbot.createStream(), pull.through(null, cb), ws)

  console.log('connected...', Date.now() - start)
  var el = Jade(null, view.layout)
  document.body.appendChild(el)
  var content = el.querySelector('#content')
  createPanel(content, streams.all())

  setup_page()
})

