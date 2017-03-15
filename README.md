# Promissory Arbiter [![Build Status](https://secure.travis-ci.org/taylor1791/promissory-arbiter.png?branch=master)](https://travis-ci.org/taylor1791/promissory-arbiter) [![Test Coverage](https://codeclimate.com/github/taylor1791/promissory-arbiter/badges/coverage.svg)](https://codeclimate.com/github/taylor1791/promissory-arbiter/coverage) [![Code Climate](https://codeclimate.com/github/taylor1791/promissory-arbiter/badges/gpa.svg)](https://codeclimate.com/github/taylor1791/promissory-arbiter) [![NPM version](https://badge-me.herokuapp.com/api/npm/promissory-arbiter.png)](http://badges.enytc.com/for/npm/promissory-arbiter) [![devDependency Status](https://david-dm.org/taylor1791/promissory-arbiter/dev-status.svg)](https://david-dm.org/taylor1791/promissory-arbiter#info=devDependencies)

[![Greenkeeper badge](https://badges.greenkeeper.io/taylor1791/promissory-arbiter.svg)](https://greenkeeper.io/)
[![Sauce Test Status](https://saucelabs.com/browser-matrix/taylor1791-arbiter.svg)](https://saucelabs.com/u/taylor1791-arbiter)

> An asynchronous, hierarchical, topic-based, promissory implementation of the pub-sub pattern

## Getting Started

Getting arbiter up and running is simple. It can be used as a `node_module` on
the client (using WebPack et al.) or on the server. It can even be
[downloaded](https://raw.github.com/taylor1791/promissory-arbiter/master/src/promissory-arbiter.js)
and set into a `third_party` or `vendor` directory and used with a high fidelity
`<script>` tag. Try it out in the console (unless you're on github)!

```
npm install promissory-arbiter
```

Here is a quick example to get you started. If you want to see more advanced
examples keep on reading. Take a look at the
[documentation site](http://taylor1791.github.io/promissory-arbiter/).

```
var Arbiter = require('promissory-arbiter');
var log = function(data, topic) {
  console.log(topic, data);
};

Arbiter.subscribe('work.code', log);
Arbiter.subscribe('work', log); // Subscribe to both `work.code` and `work`
Arbiter.subscribe('', log); // Subscribe to all messages
Arbiter.publish('work.code', {type: 'js', duration: 3600});
```

This library will only work in ES3 browsers if you provide an A+ compatible
promise library. If you need one try
[ES6-promise](https://github.com/jakearchibald/es6-promise).

## Introduction

Promissory Arbiter is a pure JavaScript implementation of the publish-subscribe
or Observer pattern. "Subscribers" subscribe to topics (or messages or channels)
and the publishers send these messages or publications when they are ready for
them. This allows components to be "loosely" coupled which can lead to more
maintainable code, if used correctly.

Promissory Arbiter is asynchronous by default. This means that all subscribers
are notified asynchronously of messages. This makes code easier to reason about
especially when subscribers fire off additional events. This also
lines up with the expectations of most other uses of the callback pattern in
JavaScript effectively reducing cognitive load. Since you have been reading
a while. Take a break by trying the following code in the console if you are
having a hard time understanding what asynchronous means.

```
Arbiter.subscribe('my.topic', log);
Arbiter.publish('my.topic', data);
console.log('I execute _before_ the subscriber on the first line!');
```

If you are a synchronous kind of bird, you can set the synchronous option to
true. If you try it in the console, remember that you changed it! For a more
complete list of options checkout [Options](#options).

```
Arbiter.options.sync = true;
```

When publishing to the topic `"a.b.c"`, all subscribers to `""`, `"a"`,
`"a.b"`, and `"a.b.c"` receive the publication in priority order. If
a subscriber in `"a.b.c"` has a higher priority than a subscriber to `""`,
it will be notified before `""`. The `"."` separates the topic "generations"
and every ancestor of a topic will be notified in addition to original
publisher topic. `""` is an ancestor of every topic (except itself).
Try out the example on the top of the page or read more about topics
in the [Topics](#topic) section below.

The last unique feature of promissory-arbiter is "promissory" features. When a
publication is made, the publisher gets a promise that it can use to reason
about the subscribers. The promise will resolve according to the specified
options. By default, when all subscribers are complete the promise fulfills
and if any fail, it rejects. This can be changed to allow for a number
fulfilled or percent of all subscribers to be fulfilled. You can even relax
the promise to be resolved when a number or percent resolves regardless of
their success or failure status. In addition to this, it has settings for only
running specified number of subscribers at at a time. All of this is documented
in the [Options](#options) section, or randomly guess the options until you
have something like the following.

```
Arbiter.subscribe('get.data', getPeople, {priority: 10});
Arbiter.subscribe('get.data', getPlaces, {priority: 9});
Arbiter.subscribe('get.data', getThings, {priority: 8});
Arbiter.subscribe('get.data', getIdeas, {priority: 7});

// Let's pretend we are in IE7 and we can only have 2 ajax requests at a time.
Arbiter.publish('get.data', null, {semaphor: 2}).then(function(results) {
  // `results` is an array of the people, places, things, and ideas,
  // however only 2 of the subscriptions were ever pending at a time!
}, function(errs) {
  // If any of the publishers fail, you can have the errors here.
});
```

## License

The ISC License

Copyright (c) 2015, Taylor Everding

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
