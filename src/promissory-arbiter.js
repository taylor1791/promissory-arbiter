(function iife (root, factory) {
  'use strict';

  var moduleName = 'Arbiter';

  // Detect AMD/RequireJS environments and register as an anonymous module
  if (typeof root.define === 'function') {
    root.define(['exports'], factory);

  // Detect CommonJS/Node environments and export arbiter
  } else if (typeof exports === 'object') {
    module.exports = factory();

  // Other "global" environments such as browsers. Attempt to expose itself
  // using the revealing module pattern.
  } else {
    root[moduleName] = factory();
  }
  // TODO When a browser ships ES6 modules support, detect it and expose the
  // goods. This is not done because there is some uncertainty how browsers will
  // handle these features. Possible methods are:
  // 1) Using try/catching around import/export statement
  // 2) Try some sort of lazy loading mechanism
}(this, function factory () {
  'use strict';

  return create();

  /**
   * A Topic is simply a string. This string is can contain any character, but
   * two characters have special meanings. The comma `','`, with optional
   * whitespace, separates individual Topics. This means that `"a, b"` is the
   * same as two separate topics, `["a", "b"]`. The second special character is
   * the period or dot `'.'`. This character separates generations. In the
   * example `"a.b"`, `"a"` is an ancestor of it and `"a.b.c"` is a descendent
   * of it. This creates a hierarchical relationship between topics. When
   * you publish a topic all of the ancestors or parents are also
   * notified. The empty string is an ancestor all topics. When publishing
   * to `"a.b.c.d"`, all subscribers to `""`, `"a"`, `"a.b"`, `"a.b.c"`,
   * `"a.b.c.d"` will be executed in priority order. If there is a
   * subscriber to `""` with a very high priority, it will be notified
   * before `"a"` with a much lower priority.
   *
   * @typedef Topic
   * @memberof Arbiter
   * @example
   *
   * Arbiter.subscribe('', function f1 () {});
   * Arbiter.subscribe('a', function f2 () {});
   * Arbiter.subscribe('a.b', function f3 () {});
   * Arbiter.subscribe('a.c', function f4 () {});
   * Arbiter.subscribe('a.b.c', function f5 () {});
   * Arbiter.publish('a.b'); // Executes f1, f2, f3 in priority order
   */

  // *************************************************************************
  //   Public Instance Functions
  // *************************************************************************

  /**
   * `Arbiter.subscribe` registers a subscription to a topic and its
   * descendants. When a publication occurs it will be notified. The behavior
   * can be modified by using the options parameter. `options.priority`
   * establishes the order to notify subscribers when multiple subscribers
   * exist. The other option is `ignorePersisted`. This allows a subscriber
   * to skip being notified of saved messages.
   *
   * @function subscribe
   * @memberof Arbiter
   *
   * @param {Topic|Topic[]} topic The title of the topic to listen for
   *   publications. Topics are hierarchical can be separated by `","`.
   * @param {Subscription} subscription The function to invoke every
   *   time a publication occurs. If `subscription` is not a function, a
   *   no-operation is put in its place.
   * @param {Object} [options]. An object that can have two properties.
   *   `ignorePersited` and `priority`.
   * @param {Object} [context=null] The value of `this` for the subscription.
   * @return {Token} A unique token to remove this subscription from
   *   the distribution list.
   *
   * @example
   * Arbiter.publish('my.topic', null, {persist: true});
   * Arbiter.subscribe('my.topic', log, {ignorePersisted: true}); // => Nothing
   */

  /**
   * A Subscription is a function provided to the `subscribe` method. It is used
   * as a callback when a publication occurs. The subscriber is considered
   * "done working" if it returns a value (even `undefined`). If an error is
   * thrown, then it is assumed that the subscriber failed. If it returns a
   * `Promise`, then it is "done" when the `Promise` is fulfilled. If rejected,
   * it is assumed to fail. If the subscriber function has a length of 3
   * or more, then it is provided with callback function as the third argument
   * to be treated as a node-style callback. The first argument to the callback
   * is the error and the second is the "return value".
   *
   * @callback Subscription
   * @memberof Arbiter
   * @param {Object} data The data associated with the publication.
   * @param {Topic} topic The topic to which the publication belongs.
   * @param {Function} [callback] A node style callback.
   * @return {Object} This is either a `Promise` or a value used to
   *   communicate when the subscriber is done.
   *
   * @example
   *
   * // All of the following look the same from a publishers perspective.
   * Arbiter.subscribe('my.topic', function() {
   *   return new Promise(function(fulfill, reject) {
   *     Math.random() > 0.5 ? fulfill('hi') : reject('bye');
   *   });
   * });
   *
   * Arbiter.subscribe('my.topic', function(data, topic, done) {
   *   Math.random() > 0.5 ? done(null, 'hi') : done('bye');
   * });
   *
   * Arbiter.subscribe('my.topic', function() {
   *   if (Math.random() > 0.5) {
   *     return 'hi';
   *   } else {
   *     throw 'bye';
   *   }
   * });
   */
  function subscribe (state, topic, subscription, options, context) {
    assert(typeof topic, 'string', 'Arbiter.subscribe', 'strings', 'topics');
    options = merge(state.options, options);

    var
      ancestor = addTopicLine(
        topic, ancestorTopicSearch(topic, state._topics)
      ),
      node = insert(
        getPriority,
        createSubscription(state, subscription, options, context),
        ancestor.subscriptions
      ),
      subscriptionToken = {
        topic: topic,
        id: node.id,
        priority: node.priority
      };

    // Notify late subscribers of persisted messages
    if (!options.ignorePersisted) {
      var
        persistedDescendents = map(getPersisted, descendents(ancestor)),
        persistedMessages = mergeBy(getFingerArrayOrder, persistedDescendents),

        persisted, i, n;

      for (i = 0, n = persistedMessages.length; i < n; i++) {
        persisted = persistedMessages[i];
        !subscription.suspended // eslint-disable-line no-unused-expressions
          && subscription.call(
            subscription.context, persisted.data, persisted.topic
          );
      }
    }

    return subscriptionToken;
  }

  /**
   * `Arbiter.publish` notifies all subscribers of a publication by invoking
   * their subscription function with the data and topic associated with the
   * publication.
   *
   * @function publish
   * @memberof Arbiter
   *
   * @param {Topic} topic All subscribers to this topic, will be notified of
   *   the publication
   * @param {Object} [data] This data is the publication that all subscribers
   *   will receive.
   * @param {Object} [options] These options override the options in
   *   Arbiter.options for this publication only. See [`Options`](#options) for
   *   a complete list
   * @return {PublicationPromise} This resolves according to
   *   [`Options`](#options)
   *
   * @example
   *
   * var options = {persist: true, preventBubble: true};
   * Arbiter.publish('app.init', 'initialization', options);
   * Arbiter.subscribe('app', log); // => Nothing because of `preventBubble`
   * Arbiter.subscribe('app.init', log); // => logs app.init initialization
   */

  /**
   * `publish` returns a `PublicationPromise`. This is a regular old
   * promise with some additional properties described below. Each property is
   * updated in real time as updates occur; it stops updating when the promise
   * fulfills. This can be changed with
   * `Arbiter.options.updateAfterSettlement`.
   *
   * @typedef PublicationPromise PublicationPromise
   * @memberof Arbiter
   * @property {number} fulfilled The number of promises fulfilled when this
   *   promise settles.
   * @property {number} rejected The number of promises rejected when this
   *   promise settles.
   * @property {number} pending The number of promises pending when this
   *   promise settles.
   * @property {Token} token If the `options.persist` is true, then a token is
   *   added to the promise so it can be removed later.
   *
   * @example
   *
   * Arbiter.subscribe('get', getFromCache);
   * Arbiter.subscribe('get', getFromAjax);
   * Arbiter.publish('get', {latch: 1})
   *   .then(function(data) {
   *     // This is fulfilled when one of the subscribers fulfills because
   *     // of `latch: 1`. In this case we could also use `latch: 0.5`.
   *   }, function(errs) {
   *     // This occurs when it is impossible to satisify the latch. In this
   *     // case, both have to fail.
   *   });
   *
   */
  function publish (state, topic, data, options) {
    assert(typeof topic, 'string', 'Arbiter.publish', 'strings', 'topics');
    options = merge(state.options, options);

    var args = [state, topic, data, options];
    if (options.sync) {
      return hierarchicalTopicDispatcher(state, topic, data, options);
    }

    return async(hierarchicalTopicDispatcher, args);
  }

  /**
   *  `Arbiter.unsubscribe` removes the subscribers associated with a token or
   *  a topic. This prevents them from being notified when a publication
   *  occurs. By default these cannot be recovered, however this also allows
   *  us to temporarily suspend them instead.
   *
   * @function unsubscribe
   * @memberof Arbiter
   *
   * @param {Token|Topic} token Removes the subscription associated with the
   *   provided token. If a topic is provided, then this removes all
   *   subscribers and their descendants are removed.
   * @param {Boolean} [suspend=false] If this true, then the subscriptions
   *   are only suspended. This means that they will not be notified of any
   *   publications, but they can be re-enabled with [Arbiter.resubscribe].
   * @return {Boolean} Returns false if the token's subscription cannot be
   *   located and true otherwise. This returns an array if multiple tokens
   *   or topics used.
   *
   * @example
   *
   * Arbiter.subscribe('a', function a () {});
   * Arbiter.subscribe('a.b', function ab () {});
   * var bToken = Arbiter.subscribe('b', function b () {});
   * Arbiter.subscribe('c', function c () {});
   * Arbiter.unsubscribe(bToken); // 'a', 'a.b', 'c' remain
   * Arbiter.unsubscribe('a'); // Only 'c' remains
   * Arbiter.unsubscribe(''); // Removes all subscriptions
   */
  function unsubscribe (state, tokens, suspend) {
    tokens = typeof tokens === 'string' ? tokens.split(/,\s*/) : tokens;
    tokens = !tokens.length ? [tokens] : tokens;

    var result = curryMap(
      {topics: state._topics, suspend: suspend}, removeSubscriber, tokens
    );

    return result.length === 1 ? result[0] : result;
  }

  /**
   *  Reactivates all subscriptions associated with a token or all
   *  subscriptions that are descendants of a topic.
   *
   * @function resubscribe
   * @memberof Arbiter
   *
   * @param {Token|Topic} token The token or topic to reactivates
   * @return {Boolean} Returns false if the token's subscription cannot be
   *   located and true otherwise. This returns an array if multiple tokens
   *   or topics used.
   *
   * @example
   *
   * Arbiter.subscribe('a, b, c', function() {}); // Create 3 listeners
   * Arbiter.unsubscribe('', true); // Suspends all listeners
   * Arbiter.resubscribe(''); // Resumes all listeners
   */
  function resubscribe (state, tokens) {
    tokens = typeof tokens === 'string' ? tokens.split(/,\s*/) : tokens;
    tokens = !tokens.length ? [tokens] : tokens;

    var result = curryMap(state._topics, unsuspendSubscriber, tokens);

    return result.length === 1 ? result[0] : result;
  }

  /**
   * Removes the publications that are stored (persisted) for late subscribers
   * by providing either a `Token` or a `Topic`.
   *
   * @memberof Arbiter
   * @param {Token|Topic} token The publication or topics to remove. Note: If
   *   provided the [PublicationPromise], then this uses the token
   *   associated with it.
   * @return {Boolean} `false` if the topic or token does not exist, `true`
   *   otherwise.
   *
   * @example
   *
   * Arbiter.publish('a', null, {persist: true});
   * Arbiter.subscribe('a', function a1 () {}); // Executes a1
   * Arbiter.removedPersisted();
   * Arbiter.subscribe('a', function a2 () {}); // Does not execute a2
   */
  function removePersisted (topics, token) {
    if (typeof token === 'string') {
      return !!applyTopicDescendents(empty, 'persisted', token, topics);
    }

    var
      tokenTopic = token.topic,
      node = ancestorTopicSearch(tokenTopic, topics);

    if (node.topic !== tokenTopic) {
      return false;
    }

    var
      id = token.id,
      persisted = node.persisted,
      i = binaryIndexBy(getId, id, node.persisted),
      persistedMessage = persisted[i];

    if (persistedMessage && persistedMessage.order === id) {
      persisted.splice(i, 1);
      return true;
    }

    return false;
  }

  /**
   * Creates a new instance of Arbiter that is completely separate from the
   * original. It has its own set of topics, subscribers, and options.
   *
   * @function create
   * @memberof Arbiter
   *
   * @return {Arbiter} The new instance.
   *
   * @example
   *
   * var arbiter = Arbiter.create();
   * Arbiter.subscribe('a', function a () {});
   * arbiter.publish('a'); // Does not execute a
   */
  function create () {
    /**
     * Arbiter has a few options to affect the way that subscribers are
     * notified and PublicationPromises are resolved.
     *
     * @typedef Options
     * @memberof Arbiter
     *
     * @property {boolean} persist=false When true, subscribers are notified
     *   of past messages.
     * @property {boolean} sync=false When true, invokes the subscription
     *   functions synchronously.
     * @property {boolean} preventBubble=false When true, only the topics
     *   that match the published topics exactly are invoked.
     * @property {number} latch=0.9999999999999999 When this number is less
     *   than one, it is the ratio of subscribers that must fulfilled before
     *   resolving the `PublicationPromise`. If greater or equal to one,
     *   then it is a count of the subscribers that must fulfill.
     * @property {boolean} settlementLatch=false Changes the resolving logic
     *   of `PublicationPromise` to be based off resolved rather than
     *   fulfilled promises. This means that failed subscribers will count
     *   toward the tally of latch.
     * @property {number} semaphor=Infinity The maximum number of subscribers
     *   to allowed to be pending at any given point in time.
     * @property {boolean} updateAfterSettlement=false If true, updates the
     *   `PublicationPromise` after it resolves.
     *
     * @example
     *
     * Arbiter.subscribe('a', log);
     * Arbiter.subscribe('a.b', log);
     * Arbiter.subscribe('a.b.c', log);
     * var promise = Arbiter.publish('a.b.c', {latch: 1});
     *
     * // Remeber publish is async by default?
     * // promise.pending === 3;
     * // promise.fulfilled === 0;
     * // promise.rejected === 0;
     */
    var
      topics = createNode(''),
      options = {
        persist: false,
        sync: false,
        preventBubble: false,
        latch: 0.9999999999999999,
        settlementLatch: false,
        semaphor: Infinity,
        updateAfterSettlement: false
      },
      arbiter = {
        _topics: topics,
        options: options,
        version: 'v1.0.0',
        id: mkGenerator(),
        create: create
      };

    arbiter.subscribe = partial1(subscribeDispatcher, arbiter);
    arbiter.publish = partial1(publish, arbiter);
    arbiter.unsubscribe = partial1(unsubscribe, arbiter);
    arbiter.resubscribe = partial1(resubscribe, arbiter);
    arbiter.removePersisted = partial1(removePersistedDispatcher, arbiter);

    return arbiter;
  }

  // *************************************************************************
  //   Private Arbiter Data Structures Functions
  // *************************************************************************

  // Takes care of all the heavy lifting of publishing a message. This
  // includes locating all topics, their subscribers, publishing the data and,
  // if necessary, storing the message for late subscribers.
  function hierarchicalTopicDispatcher (state, topic, data, options) {
    var
      lineage = findLineage(getTopic, isAncestorTopic, topic, state._topics),
      topicNode = lineage[lineage.length - 1],
      subscriptions = options.preventBubble
        ? topicNode.topic === topic ? topicNode.subscriptions : []
        : mergeBy(getFingerArrayPriority, map(getSubscriptions, lineage)),
      fulfilledPromise = subscriptionDispatcher(
        topic, data, options, subscriptions
      );

    if (options.persist) {
      var id = state.id();

      topicNode = addTopicLine(topic, topicNode);
      topicNode.persisted.push(
        {topic: topic, data: data, order: id}
      );
      fulfilledPromise.token = {
        topic: topic,
        id: id
      };
    }

    return fulfilledPromise;
  }

  // Invokes the next set of subscriptions
  function resumeSubscriptionDispatcher (
    topic, data, options, subscriptions, resolver, fulfill, reject
  ) {
    var
      promise = resolver.promise,

      subscription;

    for (
      ;
      resolver.i >= 0 && promise.pending < options.semaphor;
      resolver.i -= 1
    ) {
      subscription = subscriptions[resolver.i];
      if (!subscription.suspended) {
        promise.pending += 1;
        subscriptionInvoker(subscription, data, topic).then(fulfill, reject);
      }
    }
  }

  // Takes care of sending all the requests on their way
  function removePersistedDispatcher (state, tokens) {
    tokens = tokens && tokens.token || tokens || '';
    tokens = typeof tokens === 'string' ? tokens.split(/,\s*/) : tokens;
    tokens = !tokens.length ? [tokens] : tokens;

    var result = curryMap(state._topics, removePersisted, tokens);

    return result.length === 1 ? result[0] : result;
  }

  // Invokes all the subscriptions according to `options` and returns a promise
  // that resolves according to `options`.
  function subscriptionDispatcher (topic, data, options, subscriptions) {
    var
      resolver = createResolver(),
      fulfill = resolveUse('fulfilledValues', 'fulfilled', options, resolver),
      reject = resolveUse('rejectedValues', 'rejected', options, resolver);

    resolver.i = subscriptions.length - 1;
    resolver.resume = {
      topic: topic,
      data: data,
      subscriptions: subscriptions,
      fulfill: fulfill,
      reject: reject
    };

    resumeSubscriptionDispatcher(
      topic, data, options, subscriptions, resolver, fulfill, reject
    );
    evaluateLatch(resolver, options);

    return resolver.promise;
  }

  // Takes care all the bookkeeping work surrounding a subscriber resolving
  // resolving.
  function resolveUse (appendList, increment, options, resolver) {
    return function resolveUseClosure (value) {
      // TODO This should state.options('update..
      // TODO look at all of options.xxxx
      if (resolver.settled && !options.updateAfterSettlement) {
        return;
      }

      var promise = resolver.promise;
      resolver[appendList].push(value);
      promise[increment] += 1;
      promise.pending -= 1;

      if (resolver.i >= 0) {
        var resume = resolver.resume;

        resumeSubscriptionDispatcher(
          resume.topic, resume.data, options, resume.subscriptions,
          resolver, resume.fulfill, resume.reject
        );
        return;
      }

      evaluateLatch(resolver, options);
    };
  }

  // Resolves the latch according to `options`. Computes the hypothetical max
  // and resolves if is not met.
  function evaluateLatch (resolver, options) {
    var
      settlementLatch = options.settlementLatch,
      latch = options.latch,
      promise = resolver.promise,
      fulfilled = promise.fulfilled,
      pending = promise.pending,
      rejected = promise.rejected,
      settled = fulfilled + rejected,
      maxFulfilled = fulfilled + pending,
      total = fulfilled + pending + rejected;

    if (resolver.settled) {
      return resolver.settled;
    }

    if (!settlementLatch && latch >= 1 && maxFulfilled < latch
      || !settlementLatch && latch < 1 && maxFulfilled / total < latch
      || settlementLatch && latch >= 1 && total < latch
      || settlementLatch && latch < 1 && total === 0
    ) {
      resolver.settled = true;
      return resolver.reject(resolver.rejectedValues);
    }

    if (!settlementLatch && latch >= 1 && fulfilled >= latch
      || !settlementLatch && latch < 1 && fulfilled / total >= latch
      || settlementLatch && latch >= 1 && settled >= latch
      || settlementLatch && latch < 1 && settled / total >= latch
    ) {
      resolver.settled = true;
      return settlementLatch
        ? resolver.fulfill(
          resolver.fulfilledValues.concat(resolver.rejectedValues)
        ) : resolver.fulfill(resolver.fulfilledValues);
    }
  }

  // Invokes a subscription with the required parameters and acts as an adapter
  // for the different asynchronous mechanisms behavior. i.e. node-style
  // callbacks and promises.
  function subscriptionInvoker (subscription, data, topic) {
    var result;

    if (subscription.fn.length === 3) {
      return new Promise(function promiseResolver (fulfill, reject) {
        subscription.fn.call(
          subscription.context, data, topic, function callback (err, succ) {
            return err ? reject(err) : fulfill(succ);
          }
        );
      });
    }

    try {
      result = subscription.fn.call(subscription.context, data, topic);
    } catch (e) {
      return Promise.reject(e);
    }

    if (result && typeof result.then === 'function') {
      return result;
    }

    return Promise.resolve(result);
  }

  // This coverts `topic`, which can represent multiple subscriptions and
  // serializes them into individual topics for use with the `subscription`
  function subscribeDispatcher (state, topic, subscriptions, options, context) {
    topic = typeof topic === 'string' ? topic.split(/,\s*/) : topic;
    topic = topic && topic.length ? topic : [topic];

    var result = curryMap(
      [state, null, subscriptions, options, context],
      subscribeTopicApplier,
      topic
    );

    return result.length === 1 ? result[0] : result;
  }

  // This is (in combination with curryMap) is a hack to prevent us from
  // creating a closures on every subscription.
  function subscribeTopicApplier (args, topic) {
    args[1] = topic;
    return subscribe.apply(null, args);
  }

  // For all descendants of `topic` remove all elements of `node[property`.
  function applyTopicDescendents (f, property, topic, topics) {
    var node = ancestorTopicSearch(topic, topics);
    if (node.topic === topic) {
      return curryMap(property, f, descendents(node));
    }
  }

  // Finds the subscription associated with a token and unsuspendes it.
  // Returns false if it was removed and true it was unsuspended.
  function unsuspendSubscriber (topic, token) {
    if (typeof token === 'string') {
      return !!applyTopicDescendents(
        unsuspendTopic, 'subscriptions', token, topic
      );
    }

    var node = ancestorTopicSearch(token.topic, topic);
    if (node.topic !== token.topic) {
      return false;
    }

    var i = searchAround(
      getId, getPriority,
      token.id, token.priority,
      binaryIndexBy(getPriority, token.priority, node.subscriptions),
      node.subscriptions
    );

    if (i === -1) {
      return false;
    }

    return !!unsuspendNode(node.subscriptions[i]);
  }

  // Finds the subscription associated with a token and removes or suspends is.
  // If the subscription associated with a token cannot be found then this
  // returns false. This usually means that the token was already removed.
  function removeSubscriber (args, token) {
    var
      topics = args.topics,
      suspendSubs = args.suspend;

    if (typeof token === 'string') {
      return !!applyTopicDescendents(
        suspendSubs ? suspendTopic : empty, 'subscriptions', token, topics
      );
    }

    var node = ancestorTopicSearch(token.topic, topics);
    if (node.topic !== token.topic) {
      return false;
    }

    var i = searchAround(
      getId, getPriority,
      token.id, token.priority,
      binaryIndexBy(getPriority, token.priority, node.subscriptions),
      node.subscriptions
    );

    if (i === -1) {
      return false;
    }

    if (suspendSubs) {
      return !!suspendNode(node.subscriptions[i]);
    }

    return !!node.subscriptions.splice(i, 1);
  }

  // Finds the closest ancestor topic
  function ancestorTopicSearch (topic, node) {
    return ancestorSearch(getTopic, topic, isAncestorTopic, node);
  }

  // Takes a topic and an ancestor and adds all of the generations from the
  // ancestor to the topic returning the topic that represents the node.
  function addTopicLine (topic, ancestor) {
    var
      ancestorTopic = ancestor.topic,
      additionalTopics = [];

    if (ancestorTopic !== topic) {
      // All of the generations to add seeded by the youngest existing ancestor
      additionalTopics = reduce(
        appendPrefixedTopic, [ancestorTopic],
        topic.substr(ancestorTopic.length).replace(/^\./, '').split('.')
      );
    }

    // Add a node to the tree for each new topic
    return addFamilyLine(
      addChildTopic, map(createNode, additionalTopics.slice(1)), ancestor
    );
  }

  // Adds a child to the tree sorted by the nodes topics. Note: The parameters
  // are in the reverse order because the sole purpose of this function is to
  // be fed into reduce.
  function addChildTopic (tree, child) {
    return addChild(getTopic, child, tree);
  }

  // Appends the fully qualified topic name to the array using the last
  // element of the array. This array must have length 1. If it should start
  // at the root, then the array should be [ '' ].
  function appendPrefixedTopic (arr, topic) {
    var prefix = arr[arr.length - 1] === ''
      ? '' : arr[arr.length - 1] + '.';

    arr.push(prefix + topic);
    return arr;
  }

  // Finds the Ancestor of the specified topic or undefined
  function isAncestorTopic (topic, node) {
    var nodeTopic = getTopic(node);

    return topic === nodeTopic
      || startsWith(topic, nodeTopic + '.')
      || nodeTopic === '';
  }

  // Given a fingerArray, return the order of current item
  function getFingerArrayOrder (fingerArray) {
    var item = getPointedFinger(fingerArray);
    return item !== SYMBOL_NOTHING ? getOrder(item) : Infinity;
  }

  // Given a fingerArray, return the priority of current item
  function getFingerArrayPriority (fingerArray) {
    var item = getPointedFinger(fingerArray);
    return item !== SYMBOL_NOTHING ? getPriority(item) : Infinity;
  }

  // Extracts the topic name from the provided node
  function getTopic (node) {
    return node.topic;
  }

  // Gets the order property from a persisted subscription
  function getOrder (persistedSubscription) {
    return persistedSubscription.order;
  }

  // Retrieves the persisted messages from a topic
  function getPersisted (node) {
    return node.persisted;
  }

  // Retrieves the id of an object
  function getId (obj) {
    return obj.id;
  }

  // Extracts the priority from a subscription
  function getPriority (subscription) {
    return subscription.priority;
  }

  // Produces the subscriptions from the provided node
  function getSubscriptions (node) {
    return node.subscriptions;
  }

  // Suspends all subscribers to a topic
  function unsuspendTopic (prop, node) {
    return map(unsuspendNode, node[prop]);
  }

  // Sets the suspend property to false
  function unsuspendNode (node) {
    node.suspended = false;
    return node;
  }

  // Suspends all subscribers to a topic
  function suspendTopic (prop, node) {
    return map(suspendNode, node[prop]);
  }

  // Sets the suspend property to false
  function suspendNode (node) {
    node.suspended = true;
    return node;
  }

  // Creates a resolver object that keeps track of promise related values
  function createResolver () {
    var
      resolver = {
        settled: false,
        fulfilledValues: [],
        rejectedValues: []
      },
      promise = new Promise(function promiseResolver (fulfill, reject) {
        resolver.fulfill = fulfill;
        resolver.reject = reject;
      });

    promise.fulfilled = 0;
    promise.rejected = 0;
    promise.pending = 0;
    resolver.promise = promise;

    return resolver;
  }

  // Creates a subscription object
  function createSubscription (state, fn, options, context) {
    return {
      id: state.id(),
      fn: typeof fn === 'function' ? fn : noop,
      suspended: false,
      priority: +options.priority || 0,
      context: context || null
    };
  }

  // Creates an empty node of the tree
  function createNode (topic) {
    return {topic: topic, subscriptions: [], children: [], persisted: []};
  }

  // *************************************************************************
  //   Private Standard Data Structures Algorithms
  // *************************************************************************

  // Produces a path down the tree to a leaf of the ancestors of the topic
  function findLineage (getValue, isAncestor, value, tree, path) {
    path = path || [];

    if (tree && isAncestor(value, tree)) {
      path.push(tree);

      var // The child is only correct if the children matches the value
        childIndex = binaryIndexBy(getValue, value, tree.children), // exactly,
        foundChild = tree.children[childIndex], // otherwise the index is where
        child = foundChild && getValue(foundChild) === value // it would be
          ? foundChild : tree.children[childIndex - 1]; // (i.e. One too high)

      return findLineage(getValue, isAncestor, value, child, path);
    }

    return path;
  }

  // Searches a tree for the provided topic. If it cannot find
  // a node with the topic, it returns the closest ancestor.
  // `getValue(node) === value` means that the exact node was found
  function ancestorSearch (getValue, value, isAncestor, tree) {
    if (getValue(tree) === value) {
      return tree;
    }

    var index = binaryIndexBy(getValue, value, tree.children);
    var child1 = tree.children[index];
    var child0 = tree.children[index - 1];

    if (child1 && isAncestor(value, child1)) {
      return ancestorSearch(getValue, value, isAncestor, child1);
    }

    if (child0 && isAncestor(value, child0)) {
      return ancestorSearch(getValue, value, isAncestor, child0);
    }

    return tree;
  }

  // Produces an array of all the descendants of a node including itself. This
  // means all children, grandchildren, great-grandchildren, etc...
  function descendents (node) {
    return reduce(appendDescendents, [node], node.children);
  }

  // Appends the descnedents of `next` to the array.
  function appendDescendents (arr, next) {
    return arr.concat(descendents(next));
  }

  // Each element of `line` is a node to add as a child to the previous
  // element of `line` starting with `tree`
  function addFamilyLine (addChildToTree, line, tree) {
    return reduce(addChildToTree, tree, line);
  }

  // Adds a node child into the tree in order according to `getValue`
  function addChild (getValue, newChild, tree) {
    tree.children.splice(
      binaryIndexBy(getValue, getValue(newChild), tree.children),
      0, newChild
    );

    return newChild;
  }

  // In merge sort, two sorted array are combined to create a new sorted array
  // with the contents of both. This is a generalization of 'merge' to n
  // arrays and based on a computed function. O(n).
  function mergeBy (getItemOrder, arrays) {
    var
      n = reduce(add, 0, map(getLength, arrays)),
      result = new Array(n),
      fingerArrays = map(mkFingerArray, arrays),

      i, min;

    for (i = 0; i < n; i++) {
      min = minBy(getItemOrder, fingerArrays);

      result[i] = getPointedFinger(min);
      min.pointer += 1;
    }

    return result;
  }

  // Inserts an item in ascending order according to `getValue`.
  function insert (getValue, item, list) {
    var index = binaryIndexBy(getValue, getValue(item), list);

    list.splice(index, 0, item);
    return item;
  }

  // Searches all elements around `i` in `arr` that statisfy
  // `conditionValue(elem) === conditionValue`. This will return and index
  // such that `getValue(arr[i]) === value` or -1 if none can be found.
  function searchAround (
    getValue, getConditionValue, value, conditionValue, i, arr
  ) {
    var start = i;
    var elm = arr[i];

    while (elm && (
      getValue(elm) !== value || getConditionValue(elm) !== conditionValue)
    ) {
      elm = arr[--i];
    }

    if (!elm || getValue(elm) !== value) {
      i = Math.min(arr.length, start + 1);
      elm = arr[i];
    }

    while (elm && (
      getValue(elm) !== value || getConditionValue(elm) !== conditionValue)
    ) {
      elm = arr[++i];
    }

    if (!elm || getValue(elm) !== value) {
      return -1;
    }

    return i;
  }

  // Locates an index to insert `item` that would keep `arr` sorted. This
  // uses a binary search and has a worst and average case performance of
  // O(lg n).
  function binaryIndexBy (getValue, item, array) {
    var
      value = item,
      low = 0,
      high = array.length,
      mid, elem;

    while (low < high) {
      // divide by two and floor
      mid = low + high >>> 1;
      elem = getValue(array[mid]);

      if (elem < value) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return high;
  }

  // Finds the `minimum` element of an array according to the `valueComputer`
  // function.
  function minBy (valueComputer, list) {
    var
      idx = 0,
      winner = list[idx],
      computedWinner = valueComputer(winner),

      computedCurrent;

    while (++idx < list.length) {
      computedCurrent = valueComputer(list[idx]);

      if (computedCurrent < computedWinner) {
        computedWinner = computedCurrent;
        winner = list[idx];
      }
    }

    return winner;
  }

  // Retrieves the element that is the current focus and apply a
  function getPointedFinger (fArray) {
    var
      pointer = fArray.pointer,
      array = fArray.array;

    return array.length > pointer ? array[pointer] : SYMBOL_NOTHING;
  }

  // A finger list is a list with an additional pointer to an element.
  function mkFingerArray (array) {
    return {
      pointer: 0,
      array: array
    };
  }

  // Creates a function that always returns a unique number
  function mkGenerator () {
    var i = -9007199254740992;
    return function generator () {
      return i++;
    };
  }

  // Removes all elements of `node[property]`.
  function empty (property, node) {
    node[property].length = 0;
    return node;
  }

  // A poor-mans ES6 Symbol. Comparing to this by reference to check for
  // `Nothing` since `undefined` and `null` are valid values.
  function SYMBOL_NOTHING () {}

  // *************************************************************************
  //   Private Utility Functions
  // *************************************************************************

  // Executes a function with the specified arguments asynchronously.
  function async (f, args) {
    new Promise(invoke).then(function asyncFulfill () {
      return f.apply(null, args);
    });
  }

  // Partially applies 1 argument to a function.
  function partial1 (f, x) {
    return function partiallyApplied1 () {
      // Using slice or splice on `arguments` causes the function to be
      // unoptimizable. Who doesn't like optimization?
      var args = map(identity, arguments);

      args.unshift(x);
      return f.apply(null, args);
    };
  }

  // Returns a new object will all the properties of `a` and `b` giving
  // b the priority.
  function merge (a, b) {
    var result = {};
    var x;

    for (x in a) {
      if (a.hasOwnProperty(x)) {
        result[x] = a[x];
      }
    }

    for (x in b) {
      if (b.hasOwnProperty(x)) {
        result[x] = b[x];
      }
    }

    return result;
  }

  // Array.prototype.reduce has similar performance to Array.prototype.map, so
  // we define a custom reduce function to increase performance
  function reduce (f, seed, arr) {
    var result = seed, i, n;
    for (i = 0, n = arr.length; i < n; i++) {
      result = f(result, arr[i]);
    }
    return result;
  }

  // A special version of map to get around the performance hit for creating
  // closures as a form of currying
  function curryMap (args, f, arr) {
    var result = [], i, n;
    for (i = 0, n = arr.length; i < n; i++) {
      result.push(f(args, arr[i]));
    }
    return result;
  }

  // Array.prototype.map is supeeeeer slow. In fact, it is slower than a
  // custom map function, which is usually slower than an inline for loop, but
  // is more maintainable.
  function map (f, arr) {
    var result = [], i, n;
    for (i = 0, n = arr.length; i < n; i++) {
      result.push(f(arr[i]));
    }
    return result;
  }

  // Determines whether a string begins with the characters of another string,
  // returning true or false as appropriate.
  function startsWith (haystack, needle, startPosition) {
    startPosition = startPosition || 0;
    return haystack.lastIndexOf(needle, startPosition) === startPosition;
  }

  // Invokes the first argument as a function without any arguments. Useful
  // for resolving promises immediately.
  function invoke (f) {
    f();
  }

  // Gets the length of arrays and array-like objects.
  function getLength (x) {
    return x.length;
  }

  // "Simple" JavaScript addition ;-)
  function add (x, y) {
    return x + y;
  }

  // The only automorphism that is its own isomorphism
  function identity (x) {
    return x;
  }

  // This does nothing
  function noop () {
  }

  // Throws an error if value !=== expected. This is useful for input
  // validation.
  function assert (value, expected, method, type, identifier) {
    if (value !== expected) {
      throw new Error(method + ' only accepts ' + type + ' as ' + identifier);
    }
  }
}));

