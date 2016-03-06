module.exports = function click(name, action) {
  return h('a', {href: '#', onclick: action, style: { margin: '5px'}}, name)
}

