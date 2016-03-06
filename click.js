module.exports = function click(name, action) {
  return h('a', {href: '#', onclick: action}, name)
}

