## configuration

exports.config =
  # See docs at https://github.com/brunch/brunch/blob/master/docs/config.md
  conventions:
    assets:  /^assets/
    vendor: /^js(\/|\\)vendor/
  modules:
    wrapper: false
    definition: false
  paths:
    public: 'public'
    watched: ['assets','js']
  files:
    javascripts:
      joinTo:
        'precompiled.js': /^js/
      order:
        before: [ 'js/head.js', 'js/utils.js' ]
        after: 'js/tail.js'
  plugins:
    JSCS:
      files: ['js/']
      config:
        preset: 'google'
    afterBrunch: [
      "cat stuff/head.js public/precompiled.js stuff/tail.js > public/lib.js"
    ]
  sourceMaps: false
