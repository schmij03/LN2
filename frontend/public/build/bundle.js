
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        if (value === null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function select_option(select, value) {
        for (let i = 0; i < select.options.length; i += 1) {
            const option = select.options[i];
            if (option.__value === value) {
                option.selected = true;
                return;
            }
        }
        select.selectedIndex = -1; // no option should be selected
    }
    function select_value(select) {
        const selected_option = select.querySelector(':checked') || select.options[0];
        return selected_option && selected_option.__value;
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false }) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function afterUpdate(fn) {
        get_current_component().$$.after_update.push(fn);
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail, { cancelable = false } = {}) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail, { cancelable });
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
                return !event.defaultPrevented;
            }
            return true;
        };
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            // @ts-ignore
            callbacks.slice().forEach(fn => fn.call(this, event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function tick() {
        schedule_update();
        return resolved_promise;
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function get_spread_object(spread_props) {
        return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.48.0' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /**
     * @typedef {Object} WrappedComponent Object returned by the `wrap` method
     * @property {SvelteComponent} component - Component to load (this is always asynchronous)
     * @property {RoutePrecondition[]} [conditions] - Route pre-conditions to validate
     * @property {Object} [props] - Optional dictionary of static props
     * @property {Object} [userData] - Optional user data dictionary
     * @property {bool} _sveltesparouter - Internal flag; always set to true
     */

    /**
     * @callback AsyncSvelteComponent
     * @returns {Promise<SvelteComponent>} Returns a Promise that resolves with a Svelte component
     */

    /**
     * @callback RoutePrecondition
     * @param {RouteDetail} detail - Route detail object
     * @returns {boolean|Promise<boolean>} If the callback returns a false-y value, it's interpreted as the precondition failed, so it aborts loading the component (and won't process other pre-condition callbacks)
     */

    /**
     * @typedef {Object} WrapOptions Options object for the call to `wrap`
     * @property {SvelteComponent} [component] - Svelte component to load (this is incompatible with `asyncComponent`)
     * @property {AsyncSvelteComponent} [asyncComponent] - Function that returns a Promise that fulfills with a Svelte component (e.g. `{asyncComponent: () => import('Foo.svelte')}`)
     * @property {SvelteComponent} [loadingComponent] - Svelte component to be displayed while the async route is loading (as a placeholder); when unset or false-y, no component is shown while component
     * @property {object} [loadingParams] - Optional dictionary passed to the `loadingComponent` component as params (for an exported prop called `params`)
     * @property {object} [userData] - Optional object that will be passed to events such as `routeLoading`, `routeLoaded`, `conditionsFailed`
     * @property {object} [props] - Optional key-value dictionary of static props that will be passed to the component. The props are expanded with {...props}, so the key in the dictionary becomes the name of the prop.
     * @property {RoutePrecondition[]|RoutePrecondition} [conditions] - Route pre-conditions to add, which will be executed in order
     */

    /**
     * Wraps a component to enable multiple capabilities:
     * 1. Using dynamically-imported component, with (e.g. `{asyncComponent: () => import('Foo.svelte')}`), which also allows bundlers to do code-splitting.
     * 2. Adding route pre-conditions (e.g. `{conditions: [...]}`)
     * 3. Adding static props that are passed to the component
     * 4. Adding custom userData, which is passed to route events (e.g. route loaded events) or to route pre-conditions (e.g. `{userData: {foo: 'bar}}`)
     * 
     * @param {WrapOptions} args - Arguments object
     * @returns {WrappedComponent} Wrapped component
     */
    function wrap$1(args) {
        if (!args) {
            throw Error('Parameter args is required')
        }

        // We need to have one and only one of component and asyncComponent
        // This does a "XNOR"
        if (!args.component == !args.asyncComponent) {
            throw Error('One and only one of component and asyncComponent is required')
        }

        // If the component is not async, wrap it into a function returning a Promise
        if (args.component) {
            args.asyncComponent = () => Promise.resolve(args.component);
        }

        // Parameter asyncComponent and each item of conditions must be functions
        if (typeof args.asyncComponent != 'function') {
            throw Error('Parameter asyncComponent must be a function')
        }
        if (args.conditions) {
            // Ensure it's an array
            if (!Array.isArray(args.conditions)) {
                args.conditions = [args.conditions];
            }
            for (let i = 0; i < args.conditions.length; i++) {
                if (!args.conditions[i] || typeof args.conditions[i] != 'function') {
                    throw Error('Invalid parameter conditions[' + i + ']')
                }
            }
        }

        // Check if we have a placeholder component
        if (args.loadingComponent) {
            args.asyncComponent.loading = args.loadingComponent;
            args.asyncComponent.loadingParams = args.loadingParams || undefined;
        }

        // Returns an object that contains all the functions to execute too
        // The _sveltesparouter flag is to confirm the object was created by this router
        const obj = {
            component: args.asyncComponent,
            userData: args.userData,
            conditions: (args.conditions && args.conditions.length) ? args.conditions : undefined,
            props: (args.props && Object.keys(args.props).length) ? args.props : {},
            _sveltesparouter: true
        };

        return obj
    }

    const subscriber_queue = [];
    /**
     * Creates a `Readable` store that allows reading by subscription.
     * @param value initial value
     * @param {StartStopNotifier}start start and stop notifications for subscriptions
     */
    function readable(value, start) {
        return {
            subscribe: writable(value, start).subscribe
        };
    }
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }
    function derived(stores, fn, initial_value) {
        const single = !Array.isArray(stores);
        const stores_array = single
            ? [stores]
            : stores;
        const auto = fn.length < 2;
        return readable(initial_value, (set) => {
            let inited = false;
            const values = [];
            let pending = 0;
            let cleanup = noop;
            const sync = () => {
                if (pending) {
                    return;
                }
                cleanup();
                const result = fn(single ? values[0] : values, set);
                if (auto) {
                    set(result);
                }
                else {
                    cleanup = is_function(result) ? result : noop;
                }
            };
            const unsubscribers = stores_array.map((store, i) => subscribe(store, (value) => {
                values[i] = value;
                pending &= ~(1 << i);
                if (inited) {
                    sync();
                }
            }, () => {
                pending |= (1 << i);
            }));
            inited = true;
            sync();
            return function stop() {
                run_all(unsubscribers);
                cleanup();
            };
        });
    }

    function parse(str, loose) {
    	if (str instanceof RegExp) return { keys:false, pattern:str };
    	var c, o, tmp, ext, keys=[], pattern='', arr = str.split('/');
    	arr[0] || arr.shift();

    	while (tmp = arr.shift()) {
    		c = tmp[0];
    		if (c === '*') {
    			keys.push('wild');
    			pattern += '/(.*)';
    		} else if (c === ':') {
    			o = tmp.indexOf('?', 1);
    			ext = tmp.indexOf('.', 1);
    			keys.push( tmp.substring(1, !!~o ? o : !!~ext ? ext : tmp.length) );
    			pattern += !!~o && !~ext ? '(?:/([^/]+?))?' : '/([^/]+?)';
    			if (!!~ext) pattern += (!!~o ? '?' : '') + '\\' + tmp.substring(ext);
    		} else {
    			pattern += '/' + tmp;
    		}
    	}

    	return {
    		keys: keys,
    		pattern: new RegExp('^' + pattern + (loose ? '(?=$|\/)' : '\/?$'), 'i')
    	};
    }

    /* node_modules\svelte-spa-router\Router.svelte generated by Svelte v3.48.0 */

    const { Error: Error_1, Object: Object_1, console: console_1$3 } = globals;

    // (251:0) {:else}
    function create_else_block(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	const switch_instance_spread_levels = [/*props*/ ctx[2]];
    	var switch_value = /*component*/ ctx[0];

    	function switch_props(ctx) {
    		let switch_instance_props = {};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return {
    			props: switch_instance_props,
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    		switch_instance.$on("routeEvent", /*routeEvent_handler_1*/ ctx[7]);
    	}

    	const block = {
    		c: function create() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const switch_instance_changes = (dirty & /*props*/ 4)
    			? get_spread_update(switch_instance_spread_levels, [get_spread_object(/*props*/ ctx[2])])
    			: {};

    			if (switch_value !== (switch_value = /*component*/ ctx[0])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					switch_instance.$on("routeEvent", /*routeEvent_handler_1*/ ctx[7]);
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			} else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(251:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (244:0) {#if componentParams}
    function create_if_block(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	const switch_instance_spread_levels = [{ params: /*componentParams*/ ctx[1] }, /*props*/ ctx[2]];
    	var switch_value = /*component*/ ctx[0];

    	function switch_props(ctx) {
    		let switch_instance_props = {};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return {
    			props: switch_instance_props,
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    		switch_instance.$on("routeEvent", /*routeEvent_handler*/ ctx[6]);
    	}

    	const block = {
    		c: function create() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const switch_instance_changes = (dirty & /*componentParams, props*/ 6)
    			? get_spread_update(switch_instance_spread_levels, [
    					dirty & /*componentParams*/ 2 && { params: /*componentParams*/ ctx[1] },
    					dirty & /*props*/ 4 && get_spread_object(/*props*/ ctx[2])
    				])
    			: {};

    			if (switch_value !== (switch_value = /*component*/ ctx[0])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					switch_instance.$on("routeEvent", /*routeEvent_handler*/ ctx[6]);
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			} else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(244:0) {#if componentParams}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$b(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*componentParams*/ ctx[1]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error_1("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function wrap(component, userData, ...conditions) {
    	// Use the new wrap method and show a deprecation warning
    	// eslint-disable-next-line no-console
    	console.warn('Method `wrap` from `svelte-spa-router` is deprecated and will be removed in a future version. Please use `svelte-spa-router/wrap` instead. See http://bit.ly/svelte-spa-router-upgrading');

    	return wrap$1({ component, userData, conditions });
    }

    /**
     * @typedef {Object} Location
     * @property {string} location - Location (page/view), for example `/book`
     * @property {string} [querystring] - Querystring from the hash, as a string not parsed
     */
    /**
     * Returns the current location from the hash.
     *
     * @returns {Location} Location object
     * @private
     */
    function getLocation() {
    	const hashPosition = window.location.href.indexOf('#/');

    	let location = hashPosition > -1
    	? window.location.href.substr(hashPosition + 1)
    	: '/';

    	// Check if there's a querystring
    	const qsPosition = location.indexOf('?');

    	let querystring = '';

    	if (qsPosition > -1) {
    		querystring = location.substr(qsPosition + 1);
    		location = location.substr(0, qsPosition);
    	}

    	return { location, querystring };
    }

    const loc = readable(null, // eslint-disable-next-line prefer-arrow-callback
    function start(set) {
    	set(getLocation());

    	const update = () => {
    		set(getLocation());
    	};

    	window.addEventListener('hashchange', update, false);

    	return function stop() {
    		window.removeEventListener('hashchange', update, false);
    	};
    });

    const location = derived(loc, $loc => $loc.location);
    const querystring = derived(loc, $loc => $loc.querystring);
    const params = writable(undefined);

    async function push(location) {
    	if (!location || location.length < 1 || location.charAt(0) != '/' && location.indexOf('#/') !== 0) {
    		throw Error('Invalid parameter location');
    	}

    	// Execute this code when the current call stack is complete
    	await tick();

    	// Note: this will include scroll state in history even when restoreScrollState is false
    	history.replaceState(
    		{
    			...history.state,
    			__svelte_spa_router_scrollX: window.scrollX,
    			__svelte_spa_router_scrollY: window.scrollY
    		},
    		undefined,
    		undefined
    	);

    	window.location.hash = (location.charAt(0) == '#' ? '' : '#') + location;
    }

    async function pop() {
    	// Execute this code when the current call stack is complete
    	await tick();

    	window.history.back();
    }

    async function replace(location) {
    	if (!location || location.length < 1 || location.charAt(0) != '/' && location.indexOf('#/') !== 0) {
    		throw Error('Invalid parameter location');
    	}

    	// Execute this code when the current call stack is complete
    	await tick();

    	const dest = (location.charAt(0) == '#' ? '' : '#') + location;

    	try {
    		const newState = { ...history.state };
    		delete newState['__svelte_spa_router_scrollX'];
    		delete newState['__svelte_spa_router_scrollY'];
    		window.history.replaceState(newState, undefined, dest);
    	} catch(e) {
    		// eslint-disable-next-line no-console
    		console.warn('Caught exception while replacing the current page. If you\'re running this in the Svelte REPL, please note that the `replace` method might not work in this environment.');
    	}

    	// The method above doesn't trigger the hashchange event, so let's do that manually
    	window.dispatchEvent(new Event('hashchange'));
    }

    function link(node, opts) {
    	opts = linkOpts(opts);

    	// Only apply to <a> tags
    	if (!node || !node.tagName || node.tagName.toLowerCase() != 'a') {
    		throw Error('Action "link" can only be used with <a> tags');
    	}

    	updateLink(node, opts);

    	return {
    		update(updated) {
    			updated = linkOpts(updated);
    			updateLink(node, updated);
    		}
    	};
    }

    // Internal function used by the link function
    function updateLink(node, opts) {
    	let href = opts.href || node.getAttribute('href');

    	// Destination must start with '/' or '#/'
    	if (href && href.charAt(0) == '/') {
    		// Add # to the href attribute
    		href = '#' + href;
    	} else if (!href || href.length < 2 || href.slice(0, 2) != '#/') {
    		throw Error('Invalid value for "href" attribute: ' + href);
    	}

    	node.setAttribute('href', href);

    	node.addEventListener('click', event => {
    		// Prevent default anchor onclick behaviour
    		event.preventDefault();

    		if (!opts.disabled) {
    			scrollstateHistoryHandler(event.currentTarget.getAttribute('href'));
    		}
    	});
    }

    // Internal function that ensures the argument of the link action is always an object
    function linkOpts(val) {
    	if (val && typeof val == 'string') {
    		return { href: val };
    	} else {
    		return val || {};
    	}
    }

    /**
     * The handler attached to an anchor tag responsible for updating the
     * current history state with the current scroll state
     *
     * @param {string} href - Destination
     */
    function scrollstateHistoryHandler(href) {
    	// Setting the url (3rd arg) to href will break clicking for reasons, so don't try to do that
    	history.replaceState(
    		{
    			...history.state,
    			__svelte_spa_router_scrollX: window.scrollX,
    			__svelte_spa_router_scrollY: window.scrollY
    		},
    		undefined,
    		undefined
    	);

    	// This will force an update as desired, but this time our scroll state will be attached
    	window.location.hash = href;
    }

    function instance$b($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Router', slots, []);
    	let { routes = {} } = $$props;
    	let { prefix = '' } = $$props;
    	let { restoreScrollState = false } = $$props;

    	/**
     * Container for a route: path, component
     */
    	class RouteItem {
    		/**
     * Initializes the object and creates a regular expression from the path, using regexparam.
     *
     * @param {string} path - Path to the route (must start with '/' or '*')
     * @param {SvelteComponent|WrappedComponent} component - Svelte component for the route, optionally wrapped
     */
    		constructor(path, component) {
    			if (!component || typeof component != 'function' && (typeof component != 'object' || component._sveltesparouter !== true)) {
    				throw Error('Invalid component object');
    			}

    			// Path must be a regular or expression, or a string starting with '/' or '*'
    			if (!path || typeof path == 'string' && (path.length < 1 || path.charAt(0) != '/' && path.charAt(0) != '*') || typeof path == 'object' && !(path instanceof RegExp)) {
    				throw Error('Invalid value for "path" argument - strings must start with / or *');
    			}

    			const { pattern, keys } = parse(path);
    			this.path = path;

    			// Check if the component is wrapped and we have conditions
    			if (typeof component == 'object' && component._sveltesparouter === true) {
    				this.component = component.component;
    				this.conditions = component.conditions || [];
    				this.userData = component.userData;
    				this.props = component.props || {};
    			} else {
    				// Convert the component to a function that returns a Promise, to normalize it
    				this.component = () => Promise.resolve(component);

    				this.conditions = [];
    				this.props = {};
    			}

    			this._pattern = pattern;
    			this._keys = keys;
    		}

    		/**
     * Checks if `path` matches the current route.
     * If there's a match, will return the list of parameters from the URL (if any).
     * In case of no match, the method will return `null`.
     *
     * @param {string} path - Path to test
     * @returns {null|Object.<string, string>} List of paramters from the URL if there's a match, or `null` otherwise.
     */
    		match(path) {
    			// If there's a prefix, check if it matches the start of the path.
    			// If not, bail early, else remove it before we run the matching.
    			if (prefix) {
    				if (typeof prefix == 'string') {
    					if (path.startsWith(prefix)) {
    						path = path.substr(prefix.length) || '/';
    					} else {
    						return null;
    					}
    				} else if (prefix instanceof RegExp) {
    					const match = path.match(prefix);

    					if (match && match[0]) {
    						path = path.substr(match[0].length) || '/';
    					} else {
    						return null;
    					}
    				}
    			}

    			// Check if the pattern matches
    			const matches = this._pattern.exec(path);

    			if (matches === null) {
    				return null;
    			}

    			// If the input was a regular expression, this._keys would be false, so return matches as is
    			if (this._keys === false) {
    				return matches;
    			}

    			const out = {};
    			let i = 0;

    			while (i < this._keys.length) {
    				// In the match parameters, URL-decode all values
    				try {
    					out[this._keys[i]] = decodeURIComponent(matches[i + 1] || '') || null;
    				} catch(e) {
    					out[this._keys[i]] = null;
    				}

    				i++;
    			}

    			return out;
    		}

    		/**
     * Dictionary with route details passed to the pre-conditions functions, as well as the `routeLoading`, `routeLoaded` and `conditionsFailed` events
     * @typedef {Object} RouteDetail
     * @property {string|RegExp} route - Route matched as defined in the route definition (could be a string or a reguar expression object)
     * @property {string} location - Location path
     * @property {string} querystring - Querystring from the hash
     * @property {object} [userData] - Custom data passed by the user
     * @property {SvelteComponent} [component] - Svelte component (only in `routeLoaded` events)
     * @property {string} [name] - Name of the Svelte component (only in `routeLoaded` events)
     */
    		/**
     * Executes all conditions (if any) to control whether the route can be shown. Conditions are executed in the order they are defined, and if a condition fails, the following ones aren't executed.
     * 
     * @param {RouteDetail} detail - Route detail
     * @returns {boolean} Returns true if all the conditions succeeded
     */
    		async checkConditions(detail) {
    			for (let i = 0; i < this.conditions.length; i++) {
    				if (!await this.conditions[i](detail)) {
    					return false;
    				}
    			}

    			return true;
    		}
    	}

    	// Set up all routes
    	const routesList = [];

    	if (routes instanceof Map) {
    		// If it's a map, iterate on it right away
    		routes.forEach((route, path) => {
    			routesList.push(new RouteItem(path, route));
    		});
    	} else {
    		// We have an object, so iterate on its own properties
    		Object.keys(routes).forEach(path => {
    			routesList.push(new RouteItem(path, routes[path]));
    		});
    	}

    	// Props for the component to render
    	let component = null;

    	let componentParams = null;
    	let props = {};

    	// Event dispatcher from Svelte
    	const dispatch = createEventDispatcher();

    	// Just like dispatch, but executes on the next iteration of the event loop
    	async function dispatchNextTick(name, detail) {
    		// Execute this code when the current call stack is complete
    		await tick();

    		dispatch(name, detail);
    	}

    	// If this is set, then that means we have popped into this var the state of our last scroll position
    	let previousScrollState = null;

    	let popStateChanged = null;

    	if (restoreScrollState) {
    		popStateChanged = event => {
    			// If this event was from our history.replaceState, event.state will contain
    			// our scroll history. Otherwise, event.state will be null (like on forward
    			// navigation)
    			if (event.state && event.state.__svelte_spa_router_scrollY) {
    				previousScrollState = event.state;
    			} else {
    				previousScrollState = null;
    			}
    		};

    		// This is removed in the destroy() invocation below
    		window.addEventListener('popstate', popStateChanged);

    		afterUpdate(() => {
    			// If this exists, then this is a back navigation: restore the scroll position
    			if (previousScrollState) {
    				window.scrollTo(previousScrollState.__svelte_spa_router_scrollX, previousScrollState.__svelte_spa_router_scrollY);
    			} else {
    				// Otherwise this is a forward navigation: scroll to top
    				window.scrollTo(0, 0);
    			}
    		});
    	}

    	// Always have the latest value of loc
    	let lastLoc = null;

    	// Current object of the component loaded
    	let componentObj = null;

    	// Handle hash change events
    	// Listen to changes in the $loc store and update the page
    	// Do not use the $: syntax because it gets triggered by too many things
    	const unsubscribeLoc = loc.subscribe(async newLoc => {
    		lastLoc = newLoc;

    		// Find a route matching the location
    		let i = 0;

    		while (i < routesList.length) {
    			const match = routesList[i].match(newLoc.location);

    			if (!match) {
    				i++;
    				continue;
    			}

    			const detail = {
    				route: routesList[i].path,
    				location: newLoc.location,
    				querystring: newLoc.querystring,
    				userData: routesList[i].userData,
    				params: match && typeof match == 'object' && Object.keys(match).length
    				? match
    				: null
    			};

    			// Check if the route can be loaded - if all conditions succeed
    			if (!await routesList[i].checkConditions(detail)) {
    				// Don't display anything
    				$$invalidate(0, component = null);

    				componentObj = null;

    				// Trigger an event to notify the user, then exit
    				dispatchNextTick('conditionsFailed', detail);

    				return;
    			}

    			// Trigger an event to alert that we're loading the route
    			// We need to clone the object on every event invocation so we don't risk the object to be modified in the next tick
    			dispatchNextTick('routeLoading', Object.assign({}, detail));

    			// If there's a component to show while we're loading the route, display it
    			const obj = routesList[i].component;

    			// Do not replace the component if we're loading the same one as before, to avoid the route being unmounted and re-mounted
    			if (componentObj != obj) {
    				if (obj.loading) {
    					$$invalidate(0, component = obj.loading);
    					componentObj = obj;
    					$$invalidate(1, componentParams = obj.loadingParams);
    					$$invalidate(2, props = {});

    					// Trigger the routeLoaded event for the loading component
    					// Create a copy of detail so we don't modify the object for the dynamic route (and the dynamic route doesn't modify our object too)
    					dispatchNextTick('routeLoaded', Object.assign({}, detail, {
    						component,
    						name: component.name,
    						params: componentParams
    					}));
    				} else {
    					$$invalidate(0, component = null);
    					componentObj = null;
    				}

    				// Invoke the Promise
    				const loaded = await obj();

    				// Now that we're here, after the promise resolved, check if we still want this component, as the user might have navigated to another page in the meanwhile
    				if (newLoc != lastLoc) {
    					// Don't update the component, just exit
    					return;
    				}

    				// If there is a "default" property, which is used by async routes, then pick that
    				$$invalidate(0, component = loaded && loaded.default || loaded);

    				componentObj = obj;
    			}

    			// Set componentParams only if we have a match, to avoid a warning similar to `<Component> was created with unknown prop 'params'`
    			// Of course, this assumes that developers always add a "params" prop when they are expecting parameters
    			if (match && typeof match == 'object' && Object.keys(match).length) {
    				$$invalidate(1, componentParams = match);
    			} else {
    				$$invalidate(1, componentParams = null);
    			}

    			// Set static props, if any
    			$$invalidate(2, props = routesList[i].props);

    			// Dispatch the routeLoaded event then exit
    			// We need to clone the object on every event invocation so we don't risk the object to be modified in the next tick
    			dispatchNextTick('routeLoaded', Object.assign({}, detail, {
    				component,
    				name: component.name,
    				params: componentParams
    			})).then(() => {
    				params.set(componentParams);
    			});

    			return;
    		}

    		// If we're still here, there was no match, so show the empty component
    		$$invalidate(0, component = null);

    		componentObj = null;
    		params.set(undefined);
    	});

    	onDestroy(() => {
    		unsubscribeLoc();
    		popStateChanged && window.removeEventListener('popstate', popStateChanged);
    	});

    	const writable_props = ['routes', 'prefix', 'restoreScrollState'];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$3.warn(`<Router> was created with unknown prop '${key}'`);
    	});

    	function routeEvent_handler(event) {
    		bubble.call(this, $$self, event);
    	}

    	function routeEvent_handler_1(event) {
    		bubble.call(this, $$self, event);
    	}

    	$$self.$$set = $$props => {
    		if ('routes' in $$props) $$invalidate(3, routes = $$props.routes);
    		if ('prefix' in $$props) $$invalidate(4, prefix = $$props.prefix);
    		if ('restoreScrollState' in $$props) $$invalidate(5, restoreScrollState = $$props.restoreScrollState);
    	};

    	$$self.$capture_state = () => ({
    		readable,
    		writable,
    		derived,
    		tick,
    		_wrap: wrap$1,
    		wrap,
    		getLocation,
    		loc,
    		location,
    		querystring,
    		params,
    		push,
    		pop,
    		replace,
    		link,
    		updateLink,
    		linkOpts,
    		scrollstateHistoryHandler,
    		onDestroy,
    		createEventDispatcher,
    		afterUpdate,
    		parse,
    		routes,
    		prefix,
    		restoreScrollState,
    		RouteItem,
    		routesList,
    		component,
    		componentParams,
    		props,
    		dispatch,
    		dispatchNextTick,
    		previousScrollState,
    		popStateChanged,
    		lastLoc,
    		componentObj,
    		unsubscribeLoc
    	});

    	$$self.$inject_state = $$props => {
    		if ('routes' in $$props) $$invalidate(3, routes = $$props.routes);
    		if ('prefix' in $$props) $$invalidate(4, prefix = $$props.prefix);
    		if ('restoreScrollState' in $$props) $$invalidate(5, restoreScrollState = $$props.restoreScrollState);
    		if ('component' in $$props) $$invalidate(0, component = $$props.component);
    		if ('componentParams' in $$props) $$invalidate(1, componentParams = $$props.componentParams);
    		if ('props' in $$props) $$invalidate(2, props = $$props.props);
    		if ('previousScrollState' in $$props) previousScrollState = $$props.previousScrollState;
    		if ('popStateChanged' in $$props) popStateChanged = $$props.popStateChanged;
    		if ('lastLoc' in $$props) lastLoc = $$props.lastLoc;
    		if ('componentObj' in $$props) componentObj = $$props.componentObj;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*restoreScrollState*/ 32) {
    			// Update history.scrollRestoration depending on restoreScrollState
    			history.scrollRestoration = restoreScrollState ? 'manual' : 'auto';
    		}
    	};

    	return [
    		component,
    		componentParams,
    		props,
    		routes,
    		prefix,
    		restoreScrollState,
    		routeEvent_handler,
    		routeEvent_handler_1
    	];
    }

    class Router extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$b, create_fragment$b, safe_not_equal, {
    			routes: 3,
    			prefix: 4,
    			restoreScrollState: 5
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Router",
    			options,
    			id: create_fragment$b.name
    		});
    	}

    	get routes() {
    		throw new Error_1("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set routes(value) {
    		throw new Error_1("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get prefix() {
    		throw new Error_1("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set prefix(value) {
    		throw new Error_1("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get restoreScrollState() {
    		throw new Error_1("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set restoreScrollState(value) {
    		throw new Error_1("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\pages\Home.svelte generated by Svelte v3.48.0 */

    const file$a = "src\\pages\\Home.svelte";

    function create_fragment$a(ctx) {
    	let div0;
    	let t0;
    	let h1;
    	let t2;
    	let br0;
    	let t3;
    	let br1;
    	let t4;
    	let br2;
    	let t5;
    	let div11;
    	let div10;
    	let div3;
    	let div2;
    	let img0;
    	let img0_src_value;
    	let t6;
    	let div1;
    	let h50;
    	let t8;
    	let p0;
    	let t10;
    	let a0;
    	let t12;
    	let div6;
    	let div5;
    	let img1;
    	let img1_src_value;
    	let t13;
    	let div4;
    	let h51;
    	let t15;
    	let p1;
    	let t17;
    	let a1;
    	let t19;
    	let div9;
    	let div8;
    	let img2;
    	let img2_src_value;
    	let t20;
    	let div7;
    	let h52;
    	let t22;
    	let p2;
    	let t24;
    	let a2;

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			t0 = space();
    			h1 = element("h1");
    			h1.textContent = "Ihr Grümpi Organisator";
    			t2 = space();
    			br0 = element("br");
    			t3 = space();
    			br1 = element("br");
    			t4 = space();
    			br2 = element("br");
    			t5 = space();
    			div11 = element("div");
    			div10 = element("div");
    			div3 = element("div");
    			div2 = element("div");
    			img0 = element("img");
    			t6 = space();
    			div1 = element("div");
    			h50 = element("h5");
    			h50.textContent = "Players";
    			t8 = space();
    			p0 = element("p");
    			p0.textContent = "Overview of Players";
    			t10 = space();
    			a0 = element("a");
    			a0.textContent = "Go to Players";
    			t12 = space();
    			div6 = element("div");
    			div5 = element("div");
    			img1 = element("img");
    			t13 = space();
    			div4 = element("div");
    			h51 = element("h5");
    			h51.textContent = "Teams";
    			t15 = space();
    			p1 = element("p");
    			p1.textContent = "Overview of Teams";
    			t17 = space();
    			a1 = element("a");
    			a1.textContent = "Go to Teams";
    			t19 = space();
    			div9 = element("div");
    			div8 = element("div");
    			img2 = element("img");
    			t20 = space();
    			div7 = element("div");
    			h52 = element("h5");
    			h52.textContent = "Events";
    			t22 = space();
    			p2 = element("p");
    			p2.textContent = "Overview of Events";
    			t24 = space();
    			a2 = element("a");
    			a2.textContent = "Go to Events";
    			attr_dev(div0, "class", "my-5");
    			set_style(div0, "text-align", "center");
    			add_location(div0, file$a, 0, 0, 0);
    			attr_dev(h1, "class", "mt-12");
    			add_location(h1, file$a, 1, 0, 49);
    			add_location(br0, file$a, 2, 0, 96);
    			add_location(br1, file$a, 3, 0, 104);
    			add_location(br2, file$a, 4, 0, 112);
    			if (!src_url_equal(img0.src, img0_src_value = "/images/players.png")) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "class", "card-img-top");
    			attr_dev(img0, "alt", "...");
    			add_location(img0, file$a, 10, 16, 261);
    			attr_dev(h50, "class", "card-title");
    			add_location(h50, file$a, 12, 20, 388);
    			attr_dev(p0, "class", "card-text");
    			add_location(p0, file$a, 13, 20, 445);
    			attr_dev(a0, "href", "#/players");
    			attr_dev(a0, "class", "btn btn-primary");
    			add_location(a0, file$a, 14, 20, 511);
    			attr_dev(div1, "class", "card-body");
    			add_location(div1, file$a, 11, 16, 343);
    			attr_dev(div2, "class", "card h-100");
    			add_location(div2, file$a, 9, 12, 219);
    			attr_dev(div3, "class", "col-sm-4 mb-1");
    			add_location(div3, file$a, 8, 8, 178);
    			if (!src_url_equal(img1.src, img1_src_value = "/images/team.png")) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "class", "card-img-top");
    			attr_dev(img1, "alt", "...");
    			add_location(img1, file$a, 22, 16, 749);
    			attr_dev(h51, "class", "card-title");
    			add_location(h51, file$a, 24, 20, 873);
    			attr_dev(p1, "class", "card-text");
    			add_location(p1, file$a, 25, 20, 928);
    			attr_dev(a1, "href", "#/teams");
    			attr_dev(a1, "class", "btn btn-primary");
    			add_location(a1, file$a, 26, 20, 992);
    			attr_dev(div4, "class", "card-body");
    			add_location(div4, file$a, 23, 16, 828);
    			attr_dev(div5, "class", "card h-100");
    			add_location(div5, file$a, 21, 12, 707);
    			attr_dev(div6, "class", "col-sm-4 mb-1");
    			add_location(div6, file$a, 20, 8, 666);
    			if (!src_url_equal(img2.src, img2_src_value = "/images/events.png")) attr_dev(img2, "src", img2_src_value);
    			attr_dev(img2, "class", "card-img-top");
    			attr_dev(img2, "alt", "...");
    			add_location(img2, file$a, 33, 16, 1204);
    			attr_dev(h52, "class", "card-title");
    			add_location(h52, file$a, 35, 20, 1330);
    			attr_dev(p2, "class", "card-text");
    			add_location(p2, file$a, 36, 20, 1386);
    			attr_dev(a2, "href", "#/events");
    			attr_dev(a2, "class", "btn btn-primary");
    			add_location(a2, file$a, 37, 20, 1451);
    			attr_dev(div7, "class", "card-body");
    			add_location(div7, file$a, 34, 16, 1285);
    			attr_dev(div8, "class", "card h-100");
    			add_location(div8, file$a, 32, 12, 1162);
    			attr_dev(div9, "class", "col-sm-4 mb-1");
    			add_location(div9, file$a, 31, 8, 1121);
    			attr_dev(div10, "class", "row");
    			add_location(div10, file$a, 7, 4, 151);
    			attr_dev(div11, "class", "container");
    			add_location(div11, file$a, 6, 0, 122);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, br0, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, br1, anchor);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, br2, anchor);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, div11, anchor);
    			append_dev(div11, div10);
    			append_dev(div10, div3);
    			append_dev(div3, div2);
    			append_dev(div2, img0);
    			append_dev(div2, t6);
    			append_dev(div2, div1);
    			append_dev(div1, h50);
    			append_dev(div1, t8);
    			append_dev(div1, p0);
    			append_dev(div1, t10);
    			append_dev(div1, a0);
    			append_dev(div10, t12);
    			append_dev(div10, div6);
    			append_dev(div6, div5);
    			append_dev(div5, img1);
    			append_dev(div5, t13);
    			append_dev(div5, div4);
    			append_dev(div4, h51);
    			append_dev(div4, t15);
    			append_dev(div4, p1);
    			append_dev(div4, t17);
    			append_dev(div4, a1);
    			append_dev(div10, t19);
    			append_dev(div10, div9);
    			append_dev(div9, div8);
    			append_dev(div8, img2);
    			append_dev(div8, t20);
    			append_dev(div8, div7);
    			append_dev(div7, h52);
    			append_dev(div7, t22);
    			append_dev(div7, p2);
    			append_dev(div7, t24);
    			append_dev(div7, a2);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(br0);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(br1);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(br2);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(div11);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$a($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Home', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Home> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Home extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Home",
    			options,
    			id: create_fragment$a.name
    		});
    	}
    }

    function getDefaultExportFromCjs (x) {
    	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
    }

    var axios$3 = {exports: {}};

    var axios$2 = {exports: {}};

    var bind$2 = function bind(fn, thisArg) {
      return function wrap() {
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; i++) {
          args[i] = arguments[i];
        }
        return fn.apply(thisArg, args);
      };
    };

    var bind$1 = bind$2;

    // utils is a library of generic helper functions non-specific to axios

    var toString = Object.prototype.toString;

    // eslint-disable-next-line func-names
    var kindOf = (function(cache) {
      // eslint-disable-next-line func-names
      return function(thing) {
        var str = toString.call(thing);
        return cache[str] || (cache[str] = str.slice(8, -1).toLowerCase());
      };
    })(Object.create(null));

    function kindOfTest(type) {
      type = type.toLowerCase();
      return function isKindOf(thing) {
        return kindOf(thing) === type;
      };
    }

    /**
     * Determine if a value is an Array
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an Array, otherwise false
     */
    function isArray(val) {
      return Array.isArray(val);
    }

    /**
     * Determine if a value is undefined
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if the value is undefined, otherwise false
     */
    function isUndefined(val) {
      return typeof val === 'undefined';
    }

    /**
     * Determine if a value is a Buffer
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Buffer, otherwise false
     */
    function isBuffer(val) {
      return val !== null && !isUndefined(val) && val.constructor !== null && !isUndefined(val.constructor)
        && typeof val.constructor.isBuffer === 'function' && val.constructor.isBuffer(val);
    }

    /**
     * Determine if a value is an ArrayBuffer
     *
     * @function
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an ArrayBuffer, otherwise false
     */
    var isArrayBuffer = kindOfTest('ArrayBuffer');


    /**
     * Determine if a value is a view on an ArrayBuffer
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a view on an ArrayBuffer, otherwise false
     */
    function isArrayBufferView(val) {
      var result;
      if ((typeof ArrayBuffer !== 'undefined') && (ArrayBuffer.isView)) {
        result = ArrayBuffer.isView(val);
      } else {
        result = (val) && (val.buffer) && (isArrayBuffer(val.buffer));
      }
      return result;
    }

    /**
     * Determine if a value is a String
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a String, otherwise false
     */
    function isString(val) {
      return typeof val === 'string';
    }

    /**
     * Determine if a value is a Number
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Number, otherwise false
     */
    function isNumber(val) {
      return typeof val === 'number';
    }

    /**
     * Determine if a value is an Object
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an Object, otherwise false
     */
    function isObject(val) {
      return val !== null && typeof val === 'object';
    }

    /**
     * Determine if a value is a plain Object
     *
     * @param {Object} val The value to test
     * @return {boolean} True if value is a plain Object, otherwise false
     */
    function isPlainObject(val) {
      if (kindOf(val) !== 'object') {
        return false;
      }

      var prototype = Object.getPrototypeOf(val);
      return prototype === null || prototype === Object.prototype;
    }

    /**
     * Determine if a value is a Date
     *
     * @function
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Date, otherwise false
     */
    var isDate = kindOfTest('Date');

    /**
     * Determine if a value is a File
     *
     * @function
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a File, otherwise false
     */
    var isFile = kindOfTest('File');

    /**
     * Determine if a value is a Blob
     *
     * @function
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Blob, otherwise false
     */
    var isBlob = kindOfTest('Blob');

    /**
     * Determine if a value is a FileList
     *
     * @function
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a File, otherwise false
     */
    var isFileList = kindOfTest('FileList');

    /**
     * Determine if a value is a Function
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Function, otherwise false
     */
    function isFunction(val) {
      return toString.call(val) === '[object Function]';
    }

    /**
     * Determine if a value is a Stream
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Stream, otherwise false
     */
    function isStream(val) {
      return isObject(val) && isFunction(val.pipe);
    }

    /**
     * Determine if a value is a FormData
     *
     * @param {Object} thing The value to test
     * @returns {boolean} True if value is an FormData, otherwise false
     */
    function isFormData(thing) {
      var pattern = '[object FormData]';
      return thing && (
        (typeof FormData === 'function' && thing instanceof FormData) ||
        toString.call(thing) === pattern ||
        (isFunction(thing.toString) && thing.toString() === pattern)
      );
    }

    /**
     * Determine if a value is a URLSearchParams object
     * @function
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a URLSearchParams object, otherwise false
     */
    var isURLSearchParams = kindOfTest('URLSearchParams');

    /**
     * Trim excess whitespace off the beginning and end of a string
     *
     * @param {String} str The String to trim
     * @returns {String} The String freed of excess whitespace
     */
    function trim(str) {
      return str.trim ? str.trim() : str.replace(/^\s+|\s+$/g, '');
    }

    /**
     * Determine if we're running in a standard browser environment
     *
     * This allows axios to run in a web worker, and react-native.
     * Both environments support XMLHttpRequest, but not fully standard globals.
     *
     * web workers:
     *  typeof window -> undefined
     *  typeof document -> undefined
     *
     * react-native:
     *  navigator.product -> 'ReactNative'
     * nativescript
     *  navigator.product -> 'NativeScript' or 'NS'
     */
    function isStandardBrowserEnv() {
      if (typeof navigator !== 'undefined' && (navigator.product === 'ReactNative' ||
                                               navigator.product === 'NativeScript' ||
                                               navigator.product === 'NS')) {
        return false;
      }
      return (
        typeof window !== 'undefined' &&
        typeof document !== 'undefined'
      );
    }

    /**
     * Iterate over an Array or an Object invoking a function for each item.
     *
     * If `obj` is an Array callback will be called passing
     * the value, index, and complete array for each item.
     *
     * If 'obj' is an Object callback will be called passing
     * the value, key, and complete object for each property.
     *
     * @param {Object|Array} obj The object to iterate
     * @param {Function} fn The callback to invoke for each item
     */
    function forEach(obj, fn) {
      // Don't bother if no value provided
      if (obj === null || typeof obj === 'undefined') {
        return;
      }

      // Force an array if not already something iterable
      if (typeof obj !== 'object') {
        /*eslint no-param-reassign:0*/
        obj = [obj];
      }

      if (isArray(obj)) {
        // Iterate over array values
        for (var i = 0, l = obj.length; i < l; i++) {
          fn.call(null, obj[i], i, obj);
        }
      } else {
        // Iterate over object keys
        for (var key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            fn.call(null, obj[key], key, obj);
          }
        }
      }
    }

    /**
     * Accepts varargs expecting each argument to be an object, then
     * immutably merges the properties of each object and returns result.
     *
     * When multiple objects contain the same key the later object in
     * the arguments list will take precedence.
     *
     * Example:
     *
     * ```js
     * var result = merge({foo: 123}, {foo: 456});
     * console.log(result.foo); // outputs 456
     * ```
     *
     * @param {Object} obj1 Object to merge
     * @returns {Object} Result of all merge properties
     */
    function merge(/* obj1, obj2, obj3, ... */) {
      var result = {};
      function assignValue(val, key) {
        if (isPlainObject(result[key]) && isPlainObject(val)) {
          result[key] = merge(result[key], val);
        } else if (isPlainObject(val)) {
          result[key] = merge({}, val);
        } else if (isArray(val)) {
          result[key] = val.slice();
        } else {
          result[key] = val;
        }
      }

      for (var i = 0, l = arguments.length; i < l; i++) {
        forEach(arguments[i], assignValue);
      }
      return result;
    }

    /**
     * Extends object a by mutably adding to it the properties of object b.
     *
     * @param {Object} a The object to be extended
     * @param {Object} b The object to copy properties from
     * @param {Object} thisArg The object to bind function to
     * @return {Object} The resulting value of object a
     */
    function extend(a, b, thisArg) {
      forEach(b, function assignValue(val, key) {
        if (thisArg && typeof val === 'function') {
          a[key] = bind$1(val, thisArg);
        } else {
          a[key] = val;
        }
      });
      return a;
    }

    /**
     * Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
     *
     * @param {string} content with BOM
     * @return {string} content value without BOM
     */
    function stripBOM(content) {
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
      }
      return content;
    }

    /**
     * Inherit the prototype methods from one constructor into another
     * @param {function} constructor
     * @param {function} superConstructor
     * @param {object} [props]
     * @param {object} [descriptors]
     */

    function inherits(constructor, superConstructor, props, descriptors) {
      constructor.prototype = Object.create(superConstructor.prototype, descriptors);
      constructor.prototype.constructor = constructor;
      props && Object.assign(constructor.prototype, props);
    }

    /**
     * Resolve object with deep prototype chain to a flat object
     * @param {Object} sourceObj source object
     * @param {Object} [destObj]
     * @param {Function} [filter]
     * @returns {Object}
     */

    function toFlatObject(sourceObj, destObj, filter) {
      var props;
      var i;
      var prop;
      var merged = {};

      destObj = destObj || {};

      do {
        props = Object.getOwnPropertyNames(sourceObj);
        i = props.length;
        while (i-- > 0) {
          prop = props[i];
          if (!merged[prop]) {
            destObj[prop] = sourceObj[prop];
            merged[prop] = true;
          }
        }
        sourceObj = Object.getPrototypeOf(sourceObj);
      } while (sourceObj && (!filter || filter(sourceObj, destObj)) && sourceObj !== Object.prototype);

      return destObj;
    }

    /*
     * determines whether a string ends with the characters of a specified string
     * @param {String} str
     * @param {String} searchString
     * @param {Number} [position= 0]
     * @returns {boolean}
     */
    function endsWith(str, searchString, position) {
      str = String(str);
      if (position === undefined || position > str.length) {
        position = str.length;
      }
      position -= searchString.length;
      var lastIndex = str.indexOf(searchString, position);
      return lastIndex !== -1 && lastIndex === position;
    }


    /**
     * Returns new array from array like object
     * @param {*} [thing]
     * @returns {Array}
     */
    function toArray(thing) {
      if (!thing) return null;
      var i = thing.length;
      if (isUndefined(i)) return null;
      var arr = new Array(i);
      while (i-- > 0) {
        arr[i] = thing[i];
      }
      return arr;
    }

    // eslint-disable-next-line func-names
    var isTypedArray = (function(TypedArray) {
      // eslint-disable-next-line func-names
      return function(thing) {
        return TypedArray && thing instanceof TypedArray;
      };
    })(typeof Uint8Array !== 'undefined' && Object.getPrototypeOf(Uint8Array));

    var utils$9 = {
      isArray: isArray,
      isArrayBuffer: isArrayBuffer,
      isBuffer: isBuffer,
      isFormData: isFormData,
      isArrayBufferView: isArrayBufferView,
      isString: isString,
      isNumber: isNumber,
      isObject: isObject,
      isPlainObject: isPlainObject,
      isUndefined: isUndefined,
      isDate: isDate,
      isFile: isFile,
      isBlob: isBlob,
      isFunction: isFunction,
      isStream: isStream,
      isURLSearchParams: isURLSearchParams,
      isStandardBrowserEnv: isStandardBrowserEnv,
      forEach: forEach,
      merge: merge,
      extend: extend,
      trim: trim,
      stripBOM: stripBOM,
      inherits: inherits,
      toFlatObject: toFlatObject,
      kindOf: kindOf,
      kindOfTest: kindOfTest,
      endsWith: endsWith,
      toArray: toArray,
      isTypedArray: isTypedArray,
      isFileList: isFileList
    };

    var utils$8 = utils$9;

    function encode(val) {
      return encodeURIComponent(val).
        replace(/%3A/gi, ':').
        replace(/%24/g, '$').
        replace(/%2C/gi, ',').
        replace(/%20/g, '+').
        replace(/%5B/gi, '[').
        replace(/%5D/gi, ']');
    }

    /**
     * Build a URL by appending params to the end
     *
     * @param {string} url The base of the url (e.g., http://www.google.com)
     * @param {object} [params] The params to be appended
     * @returns {string} The formatted url
     */
    var buildURL$1 = function buildURL(url, params, paramsSerializer) {
      /*eslint no-param-reassign:0*/
      if (!params) {
        return url;
      }

      var serializedParams;
      if (paramsSerializer) {
        serializedParams = paramsSerializer(params);
      } else if (utils$8.isURLSearchParams(params)) {
        serializedParams = params.toString();
      } else {
        var parts = [];

        utils$8.forEach(params, function serialize(val, key) {
          if (val === null || typeof val === 'undefined') {
            return;
          }

          if (utils$8.isArray(val)) {
            key = key + '[]';
          } else {
            val = [val];
          }

          utils$8.forEach(val, function parseValue(v) {
            if (utils$8.isDate(v)) {
              v = v.toISOString();
            } else if (utils$8.isObject(v)) {
              v = JSON.stringify(v);
            }
            parts.push(encode(key) + '=' + encode(v));
          });
        });

        serializedParams = parts.join('&');
      }

      if (serializedParams) {
        var hashmarkIndex = url.indexOf('#');
        if (hashmarkIndex !== -1) {
          url = url.slice(0, hashmarkIndex);
        }

        url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
      }

      return url;
    };

    var utils$7 = utils$9;

    function InterceptorManager$1() {
      this.handlers = [];
    }

    /**
     * Add a new interceptor to the stack
     *
     * @param {Function} fulfilled The function to handle `then` for a `Promise`
     * @param {Function} rejected The function to handle `reject` for a `Promise`
     *
     * @return {Number} An ID used to remove interceptor later
     */
    InterceptorManager$1.prototype.use = function use(fulfilled, rejected, options) {
      this.handlers.push({
        fulfilled: fulfilled,
        rejected: rejected,
        synchronous: options ? options.synchronous : false,
        runWhen: options ? options.runWhen : null
      });
      return this.handlers.length - 1;
    };

    /**
     * Remove an interceptor from the stack
     *
     * @param {Number} id The ID that was returned by `use`
     */
    InterceptorManager$1.prototype.eject = function eject(id) {
      if (this.handlers[id]) {
        this.handlers[id] = null;
      }
    };

    /**
     * Iterate over all the registered interceptors
     *
     * This method is particularly useful for skipping over any
     * interceptors that may have become `null` calling `eject`.
     *
     * @param {Function} fn The function to call for each interceptor
     */
    InterceptorManager$1.prototype.forEach = function forEach(fn) {
      utils$7.forEach(this.handlers, function forEachHandler(h) {
        if (h !== null) {
          fn(h);
        }
      });
    };

    var InterceptorManager_1 = InterceptorManager$1;

    var utils$6 = utils$9;

    var normalizeHeaderName$1 = function normalizeHeaderName(headers, normalizedName) {
      utils$6.forEach(headers, function processHeader(value, name) {
        if (name !== normalizedName && name.toUpperCase() === normalizedName.toUpperCase()) {
          headers[normalizedName] = value;
          delete headers[name];
        }
      });
    };

    var AxiosError_1;
    var hasRequiredAxiosError;

    function requireAxiosError () {
    	if (hasRequiredAxiosError) return AxiosError_1;
    	hasRequiredAxiosError = 1;

    	var utils = utils$9;

    	/**
    	 * Create an Error with the specified message, config, error code, request and response.
    	 *
    	 * @param {string} message The error message.
    	 * @param {string} [code] The error code (for example, 'ECONNABORTED').
    	 * @param {Object} [config] The config.
    	 * @param {Object} [request] The request.
    	 * @param {Object} [response] The response.
    	 * @returns {Error} The created error.
    	 */
    	function AxiosError(message, code, config, request, response) {
    	  Error.call(this);
    	  this.message = message;
    	  this.name = 'AxiosError';
    	  code && (this.code = code);
    	  config && (this.config = config);
    	  request && (this.request = request);
    	  response && (this.response = response);
    	}

    	utils.inherits(AxiosError, Error, {
    	  toJSON: function toJSON() {
    	    return {
    	      // Standard
    	      message: this.message,
    	      name: this.name,
    	      // Microsoft
    	      description: this.description,
    	      number: this.number,
    	      // Mozilla
    	      fileName: this.fileName,
    	      lineNumber: this.lineNumber,
    	      columnNumber: this.columnNumber,
    	      stack: this.stack,
    	      // Axios
    	      config: this.config,
    	      code: this.code,
    	      status: this.response && this.response.status ? this.response.status : null
    	    };
    	  }
    	});

    	var prototype = AxiosError.prototype;
    	var descriptors = {};

    	[
    	  'ERR_BAD_OPTION_VALUE',
    	  'ERR_BAD_OPTION',
    	  'ECONNABORTED',
    	  'ETIMEDOUT',
    	  'ERR_NETWORK',
    	  'ERR_FR_TOO_MANY_REDIRECTS',
    	  'ERR_DEPRECATED',
    	  'ERR_BAD_RESPONSE',
    	  'ERR_BAD_REQUEST',
    	  'ERR_CANCELED'
    	// eslint-disable-next-line func-names
    	].forEach(function(code) {
    	  descriptors[code] = {value: code};
    	});

    	Object.defineProperties(AxiosError, descriptors);
    	Object.defineProperty(prototype, 'isAxiosError', {value: true});

    	// eslint-disable-next-line func-names
    	AxiosError.from = function(error, code, config, request, response, customProps) {
    	  var axiosError = Object.create(prototype);

    	  utils.toFlatObject(error, axiosError, function filter(obj) {
    	    return obj !== Error.prototype;
    	  });

    	  AxiosError.call(axiosError, error.message, code, config, request, response);

    	  axiosError.name = error.name;

    	  customProps && Object.assign(axiosError, customProps);

    	  return axiosError;
    	};

    	AxiosError_1 = AxiosError;
    	return AxiosError_1;
    }

    var transitional = {
      silentJSONParsing: true,
      forcedJSONParsing: true,
      clarifyTimeoutError: false
    };

    var toFormData_1;
    var hasRequiredToFormData;

    function requireToFormData () {
    	if (hasRequiredToFormData) return toFormData_1;
    	hasRequiredToFormData = 1;

    	var utils = utils$9;

    	/**
    	 * Convert a data object to FormData
    	 * @param {Object} obj
    	 * @param {?Object} [formData]
    	 * @returns {Object}
    	 **/

    	function toFormData(obj, formData) {
    	  // eslint-disable-next-line no-param-reassign
    	  formData = formData || new FormData();

    	  var stack = [];

    	  function convertValue(value) {
    	    if (value === null) return '';

    	    if (utils.isDate(value)) {
    	      return value.toISOString();
    	    }

    	    if (utils.isArrayBuffer(value) || utils.isTypedArray(value)) {
    	      return typeof Blob === 'function' ? new Blob([value]) : Buffer.from(value);
    	    }

    	    return value;
    	  }

    	  function build(data, parentKey) {
    	    if (utils.isPlainObject(data) || utils.isArray(data)) {
    	      if (stack.indexOf(data) !== -1) {
    	        throw Error('Circular reference detected in ' + parentKey);
    	      }

    	      stack.push(data);

    	      utils.forEach(data, function each(value, key) {
    	        if (utils.isUndefined(value)) return;
    	        var fullKey = parentKey ? parentKey + '.' + key : key;
    	        var arr;

    	        if (value && !parentKey && typeof value === 'object') {
    	          if (utils.endsWith(key, '{}')) {
    	            // eslint-disable-next-line no-param-reassign
    	            value = JSON.stringify(value);
    	          } else if (utils.endsWith(key, '[]') && (arr = utils.toArray(value))) {
    	            // eslint-disable-next-line func-names
    	            arr.forEach(function(el) {
    	              !utils.isUndefined(el) && formData.append(fullKey, convertValue(el));
    	            });
    	            return;
    	          }
    	        }

    	        build(value, fullKey);
    	      });

    	      stack.pop();
    	    } else {
    	      formData.append(parentKey, convertValue(data));
    	    }
    	  }

    	  build(obj);

    	  return formData;
    	}

    	toFormData_1 = toFormData;
    	return toFormData_1;
    }

    var settle;
    var hasRequiredSettle;

    function requireSettle () {
    	if (hasRequiredSettle) return settle;
    	hasRequiredSettle = 1;

    	var AxiosError = requireAxiosError();

    	/**
    	 * Resolve or reject a Promise based on response status.
    	 *
    	 * @param {Function} resolve A function that resolves the promise.
    	 * @param {Function} reject A function that rejects the promise.
    	 * @param {object} response The response.
    	 */
    	settle = function settle(resolve, reject, response) {
    	  var validateStatus = response.config.validateStatus;
    	  if (!response.status || !validateStatus || validateStatus(response.status)) {
    	    resolve(response);
    	  } else {
    	    reject(new AxiosError(
    	      'Request failed with status code ' + response.status,
    	      [AxiosError.ERR_BAD_REQUEST, AxiosError.ERR_BAD_RESPONSE][Math.floor(response.status / 100) - 4],
    	      response.config,
    	      response.request,
    	      response
    	    ));
    	  }
    	};
    	return settle;
    }

    var cookies;
    var hasRequiredCookies;

    function requireCookies () {
    	if (hasRequiredCookies) return cookies;
    	hasRequiredCookies = 1;

    	var utils = utils$9;

    	cookies = (
    	  utils.isStandardBrowserEnv() ?

    	  // Standard browser envs support document.cookie
    	    (function standardBrowserEnv() {
    	      return {
    	        write: function write(name, value, expires, path, domain, secure) {
    	          var cookie = [];
    	          cookie.push(name + '=' + encodeURIComponent(value));

    	          if (utils.isNumber(expires)) {
    	            cookie.push('expires=' + new Date(expires).toGMTString());
    	          }

    	          if (utils.isString(path)) {
    	            cookie.push('path=' + path);
    	          }

    	          if (utils.isString(domain)) {
    	            cookie.push('domain=' + domain);
    	          }

    	          if (secure === true) {
    	            cookie.push('secure');
    	          }

    	          document.cookie = cookie.join('; ');
    	        },

    	        read: function read(name) {
    	          var match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
    	          return (match ? decodeURIComponent(match[3]) : null);
    	        },

    	        remove: function remove(name) {
    	          this.write(name, '', Date.now() - 86400000);
    	        }
    	      };
    	    })() :

    	  // Non standard browser env (web workers, react-native) lack needed support.
    	    (function nonStandardBrowserEnv() {
    	      return {
    	        write: function write() {},
    	        read: function read() { return null; },
    	        remove: function remove() {}
    	      };
    	    })()
    	);
    	return cookies;
    }

    /**
     * Determines whether the specified URL is absolute
     *
     * @param {string} url The URL to test
     * @returns {boolean} True if the specified URL is absolute, otherwise false
     */
    var isAbsoluteURL$1 = function isAbsoluteURL(url) {
      // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
      // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
      // by any combination of letters, digits, plus, period, or hyphen.
      return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
    };

    /**
     * Creates a new URL by combining the specified URLs
     *
     * @param {string} baseURL The base URL
     * @param {string} relativeURL The relative URL
     * @returns {string} The combined URL
     */
    var combineURLs$1 = function combineURLs(baseURL, relativeURL) {
      return relativeURL
        ? baseURL.replace(/\/+$/, '') + '/' + relativeURL.replace(/^\/+/, '')
        : baseURL;
    };

    var isAbsoluteURL = isAbsoluteURL$1;
    var combineURLs = combineURLs$1;

    /**
     * Creates a new URL by combining the baseURL with the requestedURL,
     * only when the requestedURL is not already an absolute URL.
     * If the requestURL is absolute, this function returns the requestedURL untouched.
     *
     * @param {string} baseURL The base URL
     * @param {string} requestedURL Absolute or relative URL to combine
     * @returns {string} The combined full path
     */
    var buildFullPath$1 = function buildFullPath(baseURL, requestedURL) {
      if (baseURL && !isAbsoluteURL(requestedURL)) {
        return combineURLs(baseURL, requestedURL);
      }
      return requestedURL;
    };

    var parseHeaders;
    var hasRequiredParseHeaders;

    function requireParseHeaders () {
    	if (hasRequiredParseHeaders) return parseHeaders;
    	hasRequiredParseHeaders = 1;

    	var utils = utils$9;

    	// Headers whose duplicates are ignored by node
    	// c.f. https://nodejs.org/api/http.html#http_message_headers
    	var ignoreDuplicateOf = [
    	  'age', 'authorization', 'content-length', 'content-type', 'etag',
    	  'expires', 'from', 'host', 'if-modified-since', 'if-unmodified-since',
    	  'last-modified', 'location', 'max-forwards', 'proxy-authorization',
    	  'referer', 'retry-after', 'user-agent'
    	];

    	/**
    	 * Parse headers into an object
    	 *
    	 * ```
    	 * Date: Wed, 27 Aug 2014 08:58:49 GMT
    	 * Content-Type: application/json
    	 * Connection: keep-alive
    	 * Transfer-Encoding: chunked
    	 * ```
    	 *
    	 * @param {String} headers Headers needing to be parsed
    	 * @returns {Object} Headers parsed into an object
    	 */
    	parseHeaders = function parseHeaders(headers) {
    	  var parsed = {};
    	  var key;
    	  var val;
    	  var i;

    	  if (!headers) { return parsed; }

    	  utils.forEach(headers.split('\n'), function parser(line) {
    	    i = line.indexOf(':');
    	    key = utils.trim(line.substr(0, i)).toLowerCase();
    	    val = utils.trim(line.substr(i + 1));

    	    if (key) {
    	      if (parsed[key] && ignoreDuplicateOf.indexOf(key) >= 0) {
    	        return;
    	      }
    	      if (key === 'set-cookie') {
    	        parsed[key] = (parsed[key] ? parsed[key] : []).concat([val]);
    	      } else {
    	        parsed[key] = parsed[key] ? parsed[key] + ', ' + val : val;
    	      }
    	    }
    	  });

    	  return parsed;
    	};
    	return parseHeaders;
    }

    var isURLSameOrigin;
    var hasRequiredIsURLSameOrigin;

    function requireIsURLSameOrigin () {
    	if (hasRequiredIsURLSameOrigin) return isURLSameOrigin;
    	hasRequiredIsURLSameOrigin = 1;

    	var utils = utils$9;

    	isURLSameOrigin = (
    	  utils.isStandardBrowserEnv() ?

    	  // Standard browser envs have full support of the APIs needed to test
    	  // whether the request URL is of the same origin as current location.
    	    (function standardBrowserEnv() {
    	      var msie = /(msie|trident)/i.test(navigator.userAgent);
    	      var urlParsingNode = document.createElement('a');
    	      var originURL;

    	      /**
    	    * Parse a URL to discover it's components
    	    *
    	    * @param {String} url The URL to be parsed
    	    * @returns {Object}
    	    */
    	      function resolveURL(url) {
    	        var href = url;

    	        if (msie) {
    	        // IE needs attribute set twice to normalize properties
    	          urlParsingNode.setAttribute('href', href);
    	          href = urlParsingNode.href;
    	        }

    	        urlParsingNode.setAttribute('href', href);

    	        // urlParsingNode provides the UrlUtils interface - http://url.spec.whatwg.org/#urlutils
    	        return {
    	          href: urlParsingNode.href,
    	          protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, '') : '',
    	          host: urlParsingNode.host,
    	          search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, '') : '',
    	          hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, '') : '',
    	          hostname: urlParsingNode.hostname,
    	          port: urlParsingNode.port,
    	          pathname: (urlParsingNode.pathname.charAt(0) === '/') ?
    	            urlParsingNode.pathname :
    	            '/' + urlParsingNode.pathname
    	        };
    	      }

    	      originURL = resolveURL(window.location.href);

    	      /**
    	    * Determine if a URL shares the same origin as the current location
    	    *
    	    * @param {String} requestURL The URL to test
    	    * @returns {boolean} True if URL shares the same origin, otherwise false
    	    */
    	      return function isURLSameOrigin(requestURL) {
    	        var parsed = (utils.isString(requestURL)) ? resolveURL(requestURL) : requestURL;
    	        return (parsed.protocol === originURL.protocol &&
    	            parsed.host === originURL.host);
    	      };
    	    })() :

    	  // Non standard browser envs (web workers, react-native) lack needed support.
    	    (function nonStandardBrowserEnv() {
    	      return function isURLSameOrigin() {
    	        return true;
    	      };
    	    })()
    	);
    	return isURLSameOrigin;
    }

    var CanceledError_1;
    var hasRequiredCanceledError;

    function requireCanceledError () {
    	if (hasRequiredCanceledError) return CanceledError_1;
    	hasRequiredCanceledError = 1;

    	var AxiosError = requireAxiosError();
    	var utils = utils$9;

    	/**
    	 * A `CanceledError` is an object that is thrown when an operation is canceled.
    	 *
    	 * @class
    	 * @param {string=} message The message.
    	 */
    	function CanceledError(message) {
    	  // eslint-disable-next-line no-eq-null,eqeqeq
    	  AxiosError.call(this, message == null ? 'canceled' : message, AxiosError.ERR_CANCELED);
    	  this.name = 'CanceledError';
    	}

    	utils.inherits(CanceledError, AxiosError, {
    	  __CANCEL__: true
    	});

    	CanceledError_1 = CanceledError;
    	return CanceledError_1;
    }

    var parseProtocol;
    var hasRequiredParseProtocol;

    function requireParseProtocol () {
    	if (hasRequiredParseProtocol) return parseProtocol;
    	hasRequiredParseProtocol = 1;

    	parseProtocol = function parseProtocol(url) {
    	  var match = /^([-+\w]{1,25})(:?\/\/|:)/.exec(url);
    	  return match && match[1] || '';
    	};
    	return parseProtocol;
    }

    var xhr;
    var hasRequiredXhr;

    function requireXhr () {
    	if (hasRequiredXhr) return xhr;
    	hasRequiredXhr = 1;

    	var utils = utils$9;
    	var settle = requireSettle();
    	var cookies = requireCookies();
    	var buildURL = buildURL$1;
    	var buildFullPath = buildFullPath$1;
    	var parseHeaders = requireParseHeaders();
    	var isURLSameOrigin = requireIsURLSameOrigin();
    	var transitionalDefaults = transitional;
    	var AxiosError = requireAxiosError();
    	var CanceledError = requireCanceledError();
    	var parseProtocol = requireParseProtocol();

    	xhr = function xhrAdapter(config) {
    	  return new Promise(function dispatchXhrRequest(resolve, reject) {
    	    var requestData = config.data;
    	    var requestHeaders = config.headers;
    	    var responseType = config.responseType;
    	    var onCanceled;
    	    function done() {
    	      if (config.cancelToken) {
    	        config.cancelToken.unsubscribe(onCanceled);
    	      }

    	      if (config.signal) {
    	        config.signal.removeEventListener('abort', onCanceled);
    	      }
    	    }

    	    if (utils.isFormData(requestData) && utils.isStandardBrowserEnv()) {
    	      delete requestHeaders['Content-Type']; // Let the browser set it
    	    }

    	    var request = new XMLHttpRequest();

    	    // HTTP basic authentication
    	    if (config.auth) {
    	      var username = config.auth.username || '';
    	      var password = config.auth.password ? unescape(encodeURIComponent(config.auth.password)) : '';
    	      requestHeaders.Authorization = 'Basic ' + btoa(username + ':' + password);
    	    }

    	    var fullPath = buildFullPath(config.baseURL, config.url);

    	    request.open(config.method.toUpperCase(), buildURL(fullPath, config.params, config.paramsSerializer), true);

    	    // Set the request timeout in MS
    	    request.timeout = config.timeout;

    	    function onloadend() {
    	      if (!request) {
    	        return;
    	      }
    	      // Prepare the response
    	      var responseHeaders = 'getAllResponseHeaders' in request ? parseHeaders(request.getAllResponseHeaders()) : null;
    	      var responseData = !responseType || responseType === 'text' ||  responseType === 'json' ?
    	        request.responseText : request.response;
    	      var response = {
    	        data: responseData,
    	        status: request.status,
    	        statusText: request.statusText,
    	        headers: responseHeaders,
    	        config: config,
    	        request: request
    	      };

    	      settle(function _resolve(value) {
    	        resolve(value);
    	        done();
    	      }, function _reject(err) {
    	        reject(err);
    	        done();
    	      }, response);

    	      // Clean up request
    	      request = null;
    	    }

    	    if ('onloadend' in request) {
    	      // Use onloadend if available
    	      request.onloadend = onloadend;
    	    } else {
    	      // Listen for ready state to emulate onloadend
    	      request.onreadystatechange = function handleLoad() {
    	        if (!request || request.readyState !== 4) {
    	          return;
    	        }

    	        // The request errored out and we didn't get a response, this will be
    	        // handled by onerror instead
    	        // With one exception: request that using file: protocol, most browsers
    	        // will return status as 0 even though it's a successful request
    	        if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf('file:') === 0)) {
    	          return;
    	        }
    	        // readystate handler is calling before onerror or ontimeout handlers,
    	        // so we should call onloadend on the next 'tick'
    	        setTimeout(onloadend);
    	      };
    	    }

    	    // Handle browser request cancellation (as opposed to a manual cancellation)
    	    request.onabort = function handleAbort() {
    	      if (!request) {
    	        return;
    	      }

    	      reject(new AxiosError('Request aborted', AxiosError.ECONNABORTED, config, request));

    	      // Clean up request
    	      request = null;
    	    };

    	    // Handle low level network errors
    	    request.onerror = function handleError() {
    	      // Real errors are hidden from us by the browser
    	      // onerror should only fire if it's a network error
    	      reject(new AxiosError('Network Error', AxiosError.ERR_NETWORK, config, request, request));

    	      // Clean up request
    	      request = null;
    	    };

    	    // Handle timeout
    	    request.ontimeout = function handleTimeout() {
    	      var timeoutErrorMessage = config.timeout ? 'timeout of ' + config.timeout + 'ms exceeded' : 'timeout exceeded';
    	      var transitional = config.transitional || transitionalDefaults;
    	      if (config.timeoutErrorMessage) {
    	        timeoutErrorMessage = config.timeoutErrorMessage;
    	      }
    	      reject(new AxiosError(
    	        timeoutErrorMessage,
    	        transitional.clarifyTimeoutError ? AxiosError.ETIMEDOUT : AxiosError.ECONNABORTED,
    	        config,
    	        request));

    	      // Clean up request
    	      request = null;
    	    };

    	    // Add xsrf header
    	    // This is only done if running in a standard browser environment.
    	    // Specifically not if we're in a web worker, or react-native.
    	    if (utils.isStandardBrowserEnv()) {
    	      // Add xsrf header
    	      var xsrfValue = (config.withCredentials || isURLSameOrigin(fullPath)) && config.xsrfCookieName ?
    	        cookies.read(config.xsrfCookieName) :
    	        undefined;

    	      if (xsrfValue) {
    	        requestHeaders[config.xsrfHeaderName] = xsrfValue;
    	      }
    	    }

    	    // Add headers to the request
    	    if ('setRequestHeader' in request) {
    	      utils.forEach(requestHeaders, function setRequestHeader(val, key) {
    	        if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') {
    	          // Remove Content-Type if data is undefined
    	          delete requestHeaders[key];
    	        } else {
    	          // Otherwise add header to the request
    	          request.setRequestHeader(key, val);
    	        }
    	      });
    	    }

    	    // Add withCredentials to request if needed
    	    if (!utils.isUndefined(config.withCredentials)) {
    	      request.withCredentials = !!config.withCredentials;
    	    }

    	    // Add responseType to request if needed
    	    if (responseType && responseType !== 'json') {
    	      request.responseType = config.responseType;
    	    }

    	    // Handle progress if needed
    	    if (typeof config.onDownloadProgress === 'function') {
    	      request.addEventListener('progress', config.onDownloadProgress);
    	    }

    	    // Not all browsers support upload events
    	    if (typeof config.onUploadProgress === 'function' && request.upload) {
    	      request.upload.addEventListener('progress', config.onUploadProgress);
    	    }

    	    if (config.cancelToken || config.signal) {
    	      // Handle cancellation
    	      // eslint-disable-next-line func-names
    	      onCanceled = function(cancel) {
    	        if (!request) {
    	          return;
    	        }
    	        reject(!cancel || (cancel && cancel.type) ? new CanceledError() : cancel);
    	        request.abort();
    	        request = null;
    	      };

    	      config.cancelToken && config.cancelToken.subscribe(onCanceled);
    	      if (config.signal) {
    	        config.signal.aborted ? onCanceled() : config.signal.addEventListener('abort', onCanceled);
    	      }
    	    }

    	    if (!requestData) {
    	      requestData = null;
    	    }

    	    var protocol = parseProtocol(fullPath);

    	    if (protocol && [ 'http', 'https', 'file' ].indexOf(protocol) === -1) {
    	      reject(new AxiosError('Unsupported protocol ' + protocol + ':', AxiosError.ERR_BAD_REQUEST, config));
    	      return;
    	    }


    	    // Send the request
    	    request.send(requestData);
    	  });
    	};
    	return xhr;
    }

    var _null;
    var hasRequired_null;

    function require_null () {
    	if (hasRequired_null) return _null;
    	hasRequired_null = 1;
    	// eslint-disable-next-line strict
    	_null = null;
    	return _null;
    }

    var utils$5 = utils$9;
    var normalizeHeaderName = normalizeHeaderName$1;
    var AxiosError$1 = requireAxiosError();
    var transitionalDefaults = transitional;
    var toFormData = requireToFormData();

    var DEFAULT_CONTENT_TYPE = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    function setContentTypeIfUnset(headers, value) {
      if (!utils$5.isUndefined(headers) && utils$5.isUndefined(headers['Content-Type'])) {
        headers['Content-Type'] = value;
      }
    }

    function getDefaultAdapter() {
      var adapter;
      if (typeof XMLHttpRequest !== 'undefined') {
        // For browsers use XHR adapter
        adapter = requireXhr();
      } else if (typeof process !== 'undefined' && Object.prototype.toString.call(process) === '[object process]') {
        // For node use HTTP adapter
        adapter = requireXhr();
      }
      return adapter;
    }

    function stringifySafely(rawValue, parser, encoder) {
      if (utils$5.isString(rawValue)) {
        try {
          (parser || JSON.parse)(rawValue);
          return utils$5.trim(rawValue);
        } catch (e) {
          if (e.name !== 'SyntaxError') {
            throw e;
          }
        }
      }

      return (encoder || JSON.stringify)(rawValue);
    }

    var defaults$3 = {

      transitional: transitionalDefaults,

      adapter: getDefaultAdapter(),

      transformRequest: [function transformRequest(data, headers) {
        normalizeHeaderName(headers, 'Accept');
        normalizeHeaderName(headers, 'Content-Type');

        if (utils$5.isFormData(data) ||
          utils$5.isArrayBuffer(data) ||
          utils$5.isBuffer(data) ||
          utils$5.isStream(data) ||
          utils$5.isFile(data) ||
          utils$5.isBlob(data)
        ) {
          return data;
        }
        if (utils$5.isArrayBufferView(data)) {
          return data.buffer;
        }
        if (utils$5.isURLSearchParams(data)) {
          setContentTypeIfUnset(headers, 'application/x-www-form-urlencoded;charset=utf-8');
          return data.toString();
        }

        var isObjectPayload = utils$5.isObject(data);
        var contentType = headers && headers['Content-Type'];

        var isFileList;

        if ((isFileList = utils$5.isFileList(data)) || (isObjectPayload && contentType === 'multipart/form-data')) {
          var _FormData = this.env && this.env.FormData;
          return toFormData(isFileList ? {'files[]': data} : data, _FormData && new _FormData());
        } else if (isObjectPayload || contentType === 'application/json') {
          setContentTypeIfUnset(headers, 'application/json');
          return stringifySafely(data);
        }

        return data;
      }],

      transformResponse: [function transformResponse(data) {
        var transitional = this.transitional || defaults$3.transitional;
        var silentJSONParsing = transitional && transitional.silentJSONParsing;
        var forcedJSONParsing = transitional && transitional.forcedJSONParsing;
        var strictJSONParsing = !silentJSONParsing && this.responseType === 'json';

        if (strictJSONParsing || (forcedJSONParsing && utils$5.isString(data) && data.length)) {
          try {
            return JSON.parse(data);
          } catch (e) {
            if (strictJSONParsing) {
              if (e.name === 'SyntaxError') {
                throw AxiosError$1.from(e, AxiosError$1.ERR_BAD_RESPONSE, this, null, this.response);
              }
              throw e;
            }
          }
        }

        return data;
      }],

      /**
       * A timeout in milliseconds to abort a request. If set to 0 (default) a
       * timeout is not created.
       */
      timeout: 0,

      xsrfCookieName: 'XSRF-TOKEN',
      xsrfHeaderName: 'X-XSRF-TOKEN',

      maxContentLength: -1,
      maxBodyLength: -1,

      env: {
        FormData: require_null()
      },

      validateStatus: function validateStatus(status) {
        return status >= 200 && status < 300;
      },

      headers: {
        common: {
          'Accept': 'application/json, text/plain, */*'
        }
      }
    };

    utils$5.forEach(['delete', 'get', 'head'], function forEachMethodNoData(method) {
      defaults$3.headers[method] = {};
    });

    utils$5.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
      defaults$3.headers[method] = utils$5.merge(DEFAULT_CONTENT_TYPE);
    });

    var defaults_1 = defaults$3;

    var utils$4 = utils$9;
    var defaults$2 = defaults_1;

    /**
     * Transform the data for a request or a response
     *
     * @param {Object|String} data The data to be transformed
     * @param {Array} headers The headers for the request or response
     * @param {Array|Function} fns A single function or Array of functions
     * @returns {*} The resulting transformed data
     */
    var transformData$1 = function transformData(data, headers, fns) {
      var context = this || defaults$2;
      /*eslint no-param-reassign:0*/
      utils$4.forEach(fns, function transform(fn) {
        data = fn.call(context, data, headers);
      });

      return data;
    };

    var isCancel$1;
    var hasRequiredIsCancel;

    function requireIsCancel () {
    	if (hasRequiredIsCancel) return isCancel$1;
    	hasRequiredIsCancel = 1;

    	isCancel$1 = function isCancel(value) {
    	  return !!(value && value.__CANCEL__);
    	};
    	return isCancel$1;
    }

    var utils$3 = utils$9;
    var transformData = transformData$1;
    var isCancel = requireIsCancel();
    var defaults$1 = defaults_1;
    var CanceledError = requireCanceledError();

    /**
     * Throws a `CanceledError` if cancellation has been requested.
     */
    function throwIfCancellationRequested(config) {
      if (config.cancelToken) {
        config.cancelToken.throwIfRequested();
      }

      if (config.signal && config.signal.aborted) {
        throw new CanceledError();
      }
    }

    /**
     * Dispatch a request to the server using the configured adapter.
     *
     * @param {object} config The config that is to be used for the request
     * @returns {Promise} The Promise to be fulfilled
     */
    var dispatchRequest$1 = function dispatchRequest(config) {
      throwIfCancellationRequested(config);

      // Ensure headers exist
      config.headers = config.headers || {};

      // Transform request data
      config.data = transformData.call(
        config,
        config.data,
        config.headers,
        config.transformRequest
      );

      // Flatten headers
      config.headers = utils$3.merge(
        config.headers.common || {},
        config.headers[config.method] || {},
        config.headers
      );

      utils$3.forEach(
        ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
        function cleanHeaderConfig(method) {
          delete config.headers[method];
        }
      );

      var adapter = config.adapter || defaults$1.adapter;

      return adapter(config).then(function onAdapterResolution(response) {
        throwIfCancellationRequested(config);

        // Transform response data
        response.data = transformData.call(
          config,
          response.data,
          response.headers,
          config.transformResponse
        );

        return response;
      }, function onAdapterRejection(reason) {
        if (!isCancel(reason)) {
          throwIfCancellationRequested(config);

          // Transform response data
          if (reason && reason.response) {
            reason.response.data = transformData.call(
              config,
              reason.response.data,
              reason.response.headers,
              config.transformResponse
            );
          }
        }

        return Promise.reject(reason);
      });
    };

    var utils$2 = utils$9;

    /**
     * Config-specific merge-function which creates a new config-object
     * by merging two configuration objects together.
     *
     * @param {Object} config1
     * @param {Object} config2
     * @returns {Object} New object resulting from merging config2 to config1
     */
    var mergeConfig$2 = function mergeConfig(config1, config2) {
      // eslint-disable-next-line no-param-reassign
      config2 = config2 || {};
      var config = {};

      function getMergedValue(target, source) {
        if (utils$2.isPlainObject(target) && utils$2.isPlainObject(source)) {
          return utils$2.merge(target, source);
        } else if (utils$2.isPlainObject(source)) {
          return utils$2.merge({}, source);
        } else if (utils$2.isArray(source)) {
          return source.slice();
        }
        return source;
      }

      // eslint-disable-next-line consistent-return
      function mergeDeepProperties(prop) {
        if (!utils$2.isUndefined(config2[prop])) {
          return getMergedValue(config1[prop], config2[prop]);
        } else if (!utils$2.isUndefined(config1[prop])) {
          return getMergedValue(undefined, config1[prop]);
        }
      }

      // eslint-disable-next-line consistent-return
      function valueFromConfig2(prop) {
        if (!utils$2.isUndefined(config2[prop])) {
          return getMergedValue(undefined, config2[prop]);
        }
      }

      // eslint-disable-next-line consistent-return
      function defaultToConfig2(prop) {
        if (!utils$2.isUndefined(config2[prop])) {
          return getMergedValue(undefined, config2[prop]);
        } else if (!utils$2.isUndefined(config1[prop])) {
          return getMergedValue(undefined, config1[prop]);
        }
      }

      // eslint-disable-next-line consistent-return
      function mergeDirectKeys(prop) {
        if (prop in config2) {
          return getMergedValue(config1[prop], config2[prop]);
        } else if (prop in config1) {
          return getMergedValue(undefined, config1[prop]);
        }
      }

      var mergeMap = {
        'url': valueFromConfig2,
        'method': valueFromConfig2,
        'data': valueFromConfig2,
        'baseURL': defaultToConfig2,
        'transformRequest': defaultToConfig2,
        'transformResponse': defaultToConfig2,
        'paramsSerializer': defaultToConfig2,
        'timeout': defaultToConfig2,
        'timeoutMessage': defaultToConfig2,
        'withCredentials': defaultToConfig2,
        'adapter': defaultToConfig2,
        'responseType': defaultToConfig2,
        'xsrfCookieName': defaultToConfig2,
        'xsrfHeaderName': defaultToConfig2,
        'onUploadProgress': defaultToConfig2,
        'onDownloadProgress': defaultToConfig2,
        'decompress': defaultToConfig2,
        'maxContentLength': defaultToConfig2,
        'maxBodyLength': defaultToConfig2,
        'beforeRedirect': defaultToConfig2,
        'transport': defaultToConfig2,
        'httpAgent': defaultToConfig2,
        'httpsAgent': defaultToConfig2,
        'cancelToken': defaultToConfig2,
        'socketPath': defaultToConfig2,
        'responseEncoding': defaultToConfig2,
        'validateStatus': mergeDirectKeys
      };

      utils$2.forEach(Object.keys(config1).concat(Object.keys(config2)), function computeConfigValue(prop) {
        var merge = mergeMap[prop] || mergeDeepProperties;
        var configValue = merge(prop);
        (utils$2.isUndefined(configValue) && merge !== mergeDirectKeys) || (config[prop] = configValue);
      });

      return config;
    };

    var data;
    var hasRequiredData;

    function requireData () {
    	if (hasRequiredData) return data;
    	hasRequiredData = 1;
    	data = {
    	  "version": "0.27.2"
    	};
    	return data;
    }

    var VERSION = requireData().version;
    var AxiosError = requireAxiosError();

    var validators$1 = {};

    // eslint-disable-next-line func-names
    ['object', 'boolean', 'number', 'function', 'string', 'symbol'].forEach(function(type, i) {
      validators$1[type] = function validator(thing) {
        return typeof thing === type || 'a' + (i < 1 ? 'n ' : ' ') + type;
      };
    });

    var deprecatedWarnings = {};

    /**
     * Transitional option validator
     * @param {function|boolean?} validator - set to false if the transitional option has been removed
     * @param {string?} version - deprecated version / removed since version
     * @param {string?} message - some message with additional info
     * @returns {function}
     */
    validators$1.transitional = function transitional(validator, version, message) {
      function formatMessage(opt, desc) {
        return '[Axios v' + VERSION + '] Transitional option \'' + opt + '\'' + desc + (message ? '. ' + message : '');
      }

      // eslint-disable-next-line func-names
      return function(value, opt, opts) {
        if (validator === false) {
          throw new AxiosError(
            formatMessage(opt, ' has been removed' + (version ? ' in ' + version : '')),
            AxiosError.ERR_DEPRECATED
          );
        }

        if (version && !deprecatedWarnings[opt]) {
          deprecatedWarnings[opt] = true;
          // eslint-disable-next-line no-console
          console.warn(
            formatMessage(
              opt,
              ' has been deprecated since v' + version + ' and will be removed in the near future'
            )
          );
        }

        return validator ? validator(value, opt, opts) : true;
      };
    };

    /**
     * Assert object's properties type
     * @param {object} options
     * @param {object} schema
     * @param {boolean?} allowUnknown
     */

    function assertOptions(options, schema, allowUnknown) {
      if (typeof options !== 'object') {
        throw new AxiosError('options must be an object', AxiosError.ERR_BAD_OPTION_VALUE);
      }
      var keys = Object.keys(options);
      var i = keys.length;
      while (i-- > 0) {
        var opt = keys[i];
        var validator = schema[opt];
        if (validator) {
          var value = options[opt];
          var result = value === undefined || validator(value, opt, options);
          if (result !== true) {
            throw new AxiosError('option ' + opt + ' must be ' + result, AxiosError.ERR_BAD_OPTION_VALUE);
          }
          continue;
        }
        if (allowUnknown !== true) {
          throw new AxiosError('Unknown option ' + opt, AxiosError.ERR_BAD_OPTION);
        }
      }
    }

    var validator$1 = {
      assertOptions: assertOptions,
      validators: validators$1
    };

    var utils$1 = utils$9;
    var buildURL = buildURL$1;
    var InterceptorManager = InterceptorManager_1;
    var dispatchRequest = dispatchRequest$1;
    var mergeConfig$1 = mergeConfig$2;
    var buildFullPath = buildFullPath$1;
    var validator = validator$1;

    var validators = validator.validators;
    /**
     * Create a new instance of Axios
     *
     * @param {Object} instanceConfig The default config for the instance
     */
    function Axios$1(instanceConfig) {
      this.defaults = instanceConfig;
      this.interceptors = {
        request: new InterceptorManager(),
        response: new InterceptorManager()
      };
    }

    /**
     * Dispatch a request
     *
     * @param {Object} config The config specific for this request (merged with this.defaults)
     */
    Axios$1.prototype.request = function request(configOrUrl, config) {
      /*eslint no-param-reassign:0*/
      // Allow for axios('example/url'[, config]) a la fetch API
      if (typeof configOrUrl === 'string') {
        config = config || {};
        config.url = configOrUrl;
      } else {
        config = configOrUrl || {};
      }

      config = mergeConfig$1(this.defaults, config);

      // Set config.method
      if (config.method) {
        config.method = config.method.toLowerCase();
      } else if (this.defaults.method) {
        config.method = this.defaults.method.toLowerCase();
      } else {
        config.method = 'get';
      }

      var transitional = config.transitional;

      if (transitional !== undefined) {
        validator.assertOptions(transitional, {
          silentJSONParsing: validators.transitional(validators.boolean),
          forcedJSONParsing: validators.transitional(validators.boolean),
          clarifyTimeoutError: validators.transitional(validators.boolean)
        }, false);
      }

      // filter out skipped interceptors
      var requestInterceptorChain = [];
      var synchronousRequestInterceptors = true;
      this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
        if (typeof interceptor.runWhen === 'function' && interceptor.runWhen(config) === false) {
          return;
        }

        synchronousRequestInterceptors = synchronousRequestInterceptors && interceptor.synchronous;

        requestInterceptorChain.unshift(interceptor.fulfilled, interceptor.rejected);
      });

      var responseInterceptorChain = [];
      this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
        responseInterceptorChain.push(interceptor.fulfilled, interceptor.rejected);
      });

      var promise;

      if (!synchronousRequestInterceptors) {
        var chain = [dispatchRequest, undefined];

        Array.prototype.unshift.apply(chain, requestInterceptorChain);
        chain = chain.concat(responseInterceptorChain);

        promise = Promise.resolve(config);
        while (chain.length) {
          promise = promise.then(chain.shift(), chain.shift());
        }

        return promise;
      }


      var newConfig = config;
      while (requestInterceptorChain.length) {
        var onFulfilled = requestInterceptorChain.shift();
        var onRejected = requestInterceptorChain.shift();
        try {
          newConfig = onFulfilled(newConfig);
        } catch (error) {
          onRejected(error);
          break;
        }
      }

      try {
        promise = dispatchRequest(newConfig);
      } catch (error) {
        return Promise.reject(error);
      }

      while (responseInterceptorChain.length) {
        promise = promise.then(responseInterceptorChain.shift(), responseInterceptorChain.shift());
      }

      return promise;
    };

    Axios$1.prototype.getUri = function getUri(config) {
      config = mergeConfig$1(this.defaults, config);
      var fullPath = buildFullPath(config.baseURL, config.url);
      return buildURL(fullPath, config.params, config.paramsSerializer);
    };

    // Provide aliases for supported request methods
    utils$1.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
      /*eslint func-names:0*/
      Axios$1.prototype[method] = function(url, config) {
        return this.request(mergeConfig$1(config || {}, {
          method: method,
          url: url,
          data: (config || {}).data
        }));
      };
    });

    utils$1.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
      /*eslint func-names:0*/

      function generateHTTPMethod(isForm) {
        return function httpMethod(url, data, config) {
          return this.request(mergeConfig$1(config || {}, {
            method: method,
            headers: isForm ? {
              'Content-Type': 'multipart/form-data'
            } : {},
            url: url,
            data: data
          }));
        };
      }

      Axios$1.prototype[method] = generateHTTPMethod();

      Axios$1.prototype[method + 'Form'] = generateHTTPMethod(true);
    });

    var Axios_1 = Axios$1;

    var CancelToken_1;
    var hasRequiredCancelToken;

    function requireCancelToken () {
    	if (hasRequiredCancelToken) return CancelToken_1;
    	hasRequiredCancelToken = 1;

    	var CanceledError = requireCanceledError();

    	/**
    	 * A `CancelToken` is an object that can be used to request cancellation of an operation.
    	 *
    	 * @class
    	 * @param {Function} executor The executor function.
    	 */
    	function CancelToken(executor) {
    	  if (typeof executor !== 'function') {
    	    throw new TypeError('executor must be a function.');
    	  }

    	  var resolvePromise;

    	  this.promise = new Promise(function promiseExecutor(resolve) {
    	    resolvePromise = resolve;
    	  });

    	  var token = this;

    	  // eslint-disable-next-line func-names
    	  this.promise.then(function(cancel) {
    	    if (!token._listeners) return;

    	    var i;
    	    var l = token._listeners.length;

    	    for (i = 0; i < l; i++) {
    	      token._listeners[i](cancel);
    	    }
    	    token._listeners = null;
    	  });

    	  // eslint-disable-next-line func-names
    	  this.promise.then = function(onfulfilled) {
    	    var _resolve;
    	    // eslint-disable-next-line func-names
    	    var promise = new Promise(function(resolve) {
    	      token.subscribe(resolve);
    	      _resolve = resolve;
    	    }).then(onfulfilled);

    	    promise.cancel = function reject() {
    	      token.unsubscribe(_resolve);
    	    };

    	    return promise;
    	  };

    	  executor(function cancel(message) {
    	    if (token.reason) {
    	      // Cancellation has already been requested
    	      return;
    	    }

    	    token.reason = new CanceledError(message);
    	    resolvePromise(token.reason);
    	  });
    	}

    	/**
    	 * Throws a `CanceledError` if cancellation has been requested.
    	 */
    	CancelToken.prototype.throwIfRequested = function throwIfRequested() {
    	  if (this.reason) {
    	    throw this.reason;
    	  }
    	};

    	/**
    	 * Subscribe to the cancel signal
    	 */

    	CancelToken.prototype.subscribe = function subscribe(listener) {
    	  if (this.reason) {
    	    listener(this.reason);
    	    return;
    	  }

    	  if (this._listeners) {
    	    this._listeners.push(listener);
    	  } else {
    	    this._listeners = [listener];
    	  }
    	};

    	/**
    	 * Unsubscribe from the cancel signal
    	 */

    	CancelToken.prototype.unsubscribe = function unsubscribe(listener) {
    	  if (!this._listeners) {
    	    return;
    	  }
    	  var index = this._listeners.indexOf(listener);
    	  if (index !== -1) {
    	    this._listeners.splice(index, 1);
    	  }
    	};

    	/**
    	 * Returns an object that contains a new `CancelToken` and a function that, when called,
    	 * cancels the `CancelToken`.
    	 */
    	CancelToken.source = function source() {
    	  var cancel;
    	  var token = new CancelToken(function executor(c) {
    	    cancel = c;
    	  });
    	  return {
    	    token: token,
    	    cancel: cancel
    	  };
    	};

    	CancelToken_1 = CancelToken;
    	return CancelToken_1;
    }

    var spread;
    var hasRequiredSpread;

    function requireSpread () {
    	if (hasRequiredSpread) return spread;
    	hasRequiredSpread = 1;

    	/**
    	 * Syntactic sugar for invoking a function and expanding an array for arguments.
    	 *
    	 * Common use case would be to use `Function.prototype.apply`.
    	 *
    	 *  ```js
    	 *  function f(x, y, z) {}
    	 *  var args = [1, 2, 3];
    	 *  f.apply(null, args);
    	 *  ```
    	 *
    	 * With `spread` this example can be re-written.
    	 *
    	 *  ```js
    	 *  spread(function(x, y, z) {})([1, 2, 3]);
    	 *  ```
    	 *
    	 * @param {Function} callback
    	 * @returns {Function}
    	 */
    	spread = function spread(callback) {
    	  return function wrap(arr) {
    	    return callback.apply(null, arr);
    	  };
    	};
    	return spread;
    }

    var isAxiosError;
    var hasRequiredIsAxiosError;

    function requireIsAxiosError () {
    	if (hasRequiredIsAxiosError) return isAxiosError;
    	hasRequiredIsAxiosError = 1;

    	var utils = utils$9;

    	/**
    	 * Determines whether the payload is an error thrown by Axios
    	 *
    	 * @param {*} payload The value to test
    	 * @returns {boolean} True if the payload is an error thrown by Axios, otherwise false
    	 */
    	isAxiosError = function isAxiosError(payload) {
    	  return utils.isObject(payload) && (payload.isAxiosError === true);
    	};
    	return isAxiosError;
    }

    var utils = utils$9;
    var bind = bind$2;
    var Axios = Axios_1;
    var mergeConfig = mergeConfig$2;
    var defaults = defaults_1;

    /**
     * Create an instance of Axios
     *
     * @param {Object} defaultConfig The default config for the instance
     * @return {Axios} A new instance of Axios
     */
    function createInstance(defaultConfig) {
      var context = new Axios(defaultConfig);
      var instance = bind(Axios.prototype.request, context);

      // Copy axios.prototype to instance
      utils.extend(instance, Axios.prototype, context);

      // Copy context to instance
      utils.extend(instance, context);

      // Factory for creating new instances
      instance.create = function create(instanceConfig) {
        return createInstance(mergeConfig(defaultConfig, instanceConfig));
      };

      return instance;
    }

    // Create the default instance to be exported
    var axios$1 = createInstance(defaults);

    // Expose Axios class to allow class inheritance
    axios$1.Axios = Axios;

    // Expose Cancel & CancelToken
    axios$1.CanceledError = requireCanceledError();
    axios$1.CancelToken = requireCancelToken();
    axios$1.isCancel = requireIsCancel();
    axios$1.VERSION = requireData().version;
    axios$1.toFormData = requireToFormData();

    // Expose AxiosError class
    axios$1.AxiosError = requireAxiosError();

    // alias for CanceledError for backward compatibility
    axios$1.Cancel = axios$1.CanceledError;

    // Expose all/spread
    axios$1.all = function all(promises) {
      return Promise.all(promises);
    };
    axios$1.spread = requireSpread();

    // Expose isAxiosError
    axios$1.isAxiosError = requireIsAxiosError();

    axios$2.exports = axios$1;

    // Allow use of default import syntax in TypeScript
    axios$2.exports.default = axios$1;

    (function (module) {
    	module.exports = axios$2.exports;
    } (axios$3));

    var axios = /*@__PURE__*/getDefaultExportFromCjs(axios$3.exports);

    /* src\pages\Teams\Teams.svelte generated by Svelte v3.48.0 */
    const file$9 = "src\\pages\\Teams\\Teams.svelte";

    function get_each_context$4(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[2] = list[i];
    	return child_ctx;
    }

    // (28:12) {#each teams as team}
    function create_each_block$4(ctx) {
    	let tr;
    	let td0;
    	let t0_value = /*team*/ ctx[2].name + "";
    	let t0;
    	let t1;
    	let td1;
    	let t2_value = /*team*/ ctx[2].sportart + "";
    	let t2;
    	let t3;
    	let td2;
    	let a;
    	let t4;
    	let a_href_value;
    	let t5;

    	const block = {
    		c: function create() {
    			tr = element("tr");
    			td0 = element("td");
    			t0 = text(t0_value);
    			t1 = space();
    			td1 = element("td");
    			t2 = text(t2_value);
    			t3 = space();
    			td2 = element("td");
    			a = element("a");
    			t4 = text("Details");
    			t5 = space();
    			add_location(td0, file$9, 29, 20, 754);
    			add_location(td1, file$9, 32, 20, 844);
    			attr_dev(a, "href", a_href_value = "#/teams/" + /*team*/ ctx[2]._id);
    			add_location(a, file$9, 33, 24, 895);
    			add_location(td2, file$9, 33, 20, 891);
    			add_location(tr, file$9, 28, 16, 728);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, tr, anchor);
    			append_dev(tr, td0);
    			append_dev(td0, t0);
    			append_dev(tr, t1);
    			append_dev(tr, td1);
    			append_dev(td1, t2);
    			append_dev(tr, t3);
    			append_dev(tr, td2);
    			append_dev(td2, a);
    			append_dev(a, t4);
    			append_dev(tr, t5);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*teams*/ 1 && t0_value !== (t0_value = /*team*/ ctx[2].name + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*teams*/ 1 && t2_value !== (t2_value = /*team*/ ctx[2].sportart + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*teams*/ 1 && a_href_value !== (a_href_value = "#/teams/" + /*team*/ ctx[2]._id)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(tr);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$4.name,
    		type: "each",
    		source: "(28:12) {#each teams as team}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$9(ctx) {
    	let div;
    	let h1;
    	let t1;
    	let a;
    	let button;
    	let t3;
    	let table;
    	let thead;
    	let tr;
    	let th0;
    	let t5;
    	let th1;
    	let t7;
    	let th2;
    	let t9;
    	let tbody;
    	let each_value = /*teams*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$4(get_each_context$4(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			h1 = element("h1");
    			h1.textContent = "List of all Teams";
    			t1 = space();
    			a = element("a");
    			button = element("button");
    			button.textContent = "Add Team";
    			t3 = space();
    			table = element("table");
    			thead = element("thead");
    			tr = element("tr");
    			th0 = element("th");
    			th0.textContent = "Name";
    			t5 = space();
    			th1 = element("th");
    			th1.textContent = "Sportart";
    			t7 = space();
    			th2 = element("th");
    			th2.textContent = "Teaminfo";
    			t9 = space();
    			tbody = element("tbody");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(h1, "class", "mt-3");
    			add_location(h1, file$9, 14, 4, 279);
    			attr_dev(button, "type", "button");
    			attr_dev(button, "class", "btn btn-primary");
    			add_location(button, file$9, 16, 9, 358);
    			attr_dev(a, "href", "#/create-team");
    			add_location(a, file$9, 15, 4, 324);
    			add_location(th0, file$9, 21, 16, 538);
    			add_location(th1, file$9, 22, 16, 569);
    			add_location(th2, file$9, 23, 16, 604);
    			add_location(tr, file$9, 20, 12, 516);
    			add_location(thead, file$9, 19, 8, 495);
    			add_location(tbody, file$9, 26, 8, 668);
    			attr_dev(table, "class", "table table-striped table-hover");
    			add_location(table, file$9, 18, 4, 438);
    			attr_dev(div, "class", "mb-5");
    			add_location(div, file$9, 13, 0, 255);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h1);
    			append_dev(div, t1);
    			append_dev(div, a);
    			append_dev(a, button);
    			append_dev(div, t3);
    			append_dev(div, table);
    			append_dev(table, thead);
    			append_dev(thead, tr);
    			append_dev(tr, th0);
    			append_dev(tr, t5);
    			append_dev(tr, th1);
    			append_dev(tr, t7);
    			append_dev(tr, th2);
    			append_dev(table, t9);
    			append_dev(table, tbody);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(tbody, null);
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*teams*/ 1) {
    				each_value = /*teams*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$4(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$4(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(tbody, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Teams', slots, []);
    	let teams = [];

    	function getTeams() {
    		axios.get("http://localhost:3001/api/teams").then(response => {
    			$$invalidate(0, teams = response.data);
    		});
    	}

    	getTeams();
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Teams> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ axios, teams, getTeams });

    	$$self.$inject_state = $$props => {
    		if ('teams' in $$props) $$invalidate(0, teams = $$props.teams);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [teams];
    }

    class Teams extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Teams",
    			options,
    			id: create_fragment$9.name
    		});
    	}
    }

    /* src\pages\Teams\TeamsDetail.svelte generated by Svelte v3.48.0 */
    const file$8 = "src\\pages\\Teams\\TeamsDetail.svelte";

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[10] = list[i];
    	return child_ctx;
    }

    function get_each_context_1$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[10] = list[i];
    	return child_ctx;
    }

    // (75:8) {#each team.players as p}
    function create_each_block_1$1(ctx) {
    	let li;
    	let a;
    	let t0_value = /*p*/ ctx[10] + "";
    	let t0;
    	let a_href_value;
    	let t1;

    	const block = {
    		c: function create() {
    			li = element("li");
    			a = element("a");
    			t0 = text(t0_value);
    			t1 = space();
    			attr_dev(a, "href", a_href_value = "#/players/" + /*p*/ ctx[10]);
    			add_location(a, file$8, 76, 16, 1606);
    			add_location(li, file$8, 75, 12, 1584);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, a);
    			append_dev(a, t0);
    			append_dev(li, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*team*/ 4 && t0_value !== (t0_value = /*p*/ ctx[10] + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*team*/ 4 && a_href_value !== (a_href_value = "#/players/" + /*p*/ ctx[10])) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1$1.name,
    		type: "each",
    		source: "(75:8) {#each team.players as p}",
    		ctx
    	});

    	return block;
    }

    // (86:8) {#each players as p}
    function create_each_block$3(ctx) {
    	let option;
    	let t_value = /*p*/ ctx[10].name + "";
    	let t;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*p*/ ctx[10]._id;
    			option.value = option.__value;
    			add_location(option, file$8, 87, 11, 1903);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*players*/ 8 && t_value !== (t_value = /*p*/ ctx[10].name + "")) set_data_dev(t, t_value);

    			if (dirty & /*players*/ 8 && option_value_value !== (option_value_value = /*p*/ ctx[10]._id)) {
    				prop_dev(option, "__value", option_value_value);
    				option.value = option.__value;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$3.name,
    		type: "each",
    		source: "(86:8) {#each players as p}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$8(ctx) {
    	let div;
    	let h1;
    	let t0;
    	let t1_value = /*team*/ ctx[2].name + "";
    	let t1;
    	let t2;
    	let p0;
    	let t3;
    	let t4_value = /*team*/ ctx[2].sportart + "";
    	let t4;
    	let t5;
    	let p1;
    	let t7;
    	let ul;
    	let t8;
    	let h2;
    	let t10;
    	let label;
    	let t12;
    	let select;
    	let t13;
    	let button0;
    	let t15;
    	let a0;
    	let button1;
    	let t17;
    	let a1;
    	let button2;
    	let a1_href_value;
    	let mounted;
    	let dispose;
    	let each_value_1 = /*team*/ ctx[2].players;
    	validate_each_argument(each_value_1);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1$1(get_each_context_1$1(ctx, each_value_1, i));
    	}

    	let each_value = /*players*/ ctx[3];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			h1 = element("h1");
    			t0 = text("Team: ");
    			t1 = text(t1_value);
    			t2 = space();
    			p0 = element("p");
    			t3 = text("Sportart: ");
    			t4 = text(t4_value);
    			t5 = space();
    			p1 = element("p");
    			p1.textContent = "Players:";
    			t7 = space();
    			ul = element("ul");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t8 = space();
    			h2 = element("h2");
    			h2.textContent = "Update Players";
    			t10 = space();
    			label = element("label");
    			label.textContent = "Add Players to team";
    			t12 = space();
    			select = element("select");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t13 = space();
    			button0 = element("button");
    			button0.textContent = "Update Team";
    			t15 = space();
    			a0 = element("a");
    			button1 = element("button");
    			button1.textContent = "Delete Team";
    			t17 = space();
    			a1 = element("a");
    			button2 = element("button");
    			button2.textContent = "Edit Team";
    			attr_dev(h1, "class", "mt-3");
    			add_location(h1, file$8, 70, 4, 1427);
    			add_location(p0, file$8, 71, 4, 1472);
    			add_location(p1, file$8, 72, 4, 1510);
    			add_location(ul, file$8, 73, 4, 1531);
    			add_location(h2, file$8, 81, 4, 1695);
    			attr_dev(label, "for", "player");
    			add_location(label, file$8, 82, 4, 1724);
    			attr_dev(select, "class", "form-select");
    			attr_dev(select, "id", "player");
    			if (/*player_id*/ ctx[1] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[7].call(select));
    			add_location(select, file$8, 84, 4, 1783);
    			attr_dev(button0, "class", "btn btn-primary mt-2");
    			add_location(button0, file$8, 91, 4, 1987);
    			attr_dev(div, "class", "mb-5");
    			add_location(div, file$8, 69, 0, 1403);
    			attr_dev(button1, "type", "button");
    			attr_dev(button1, "class", "btn btn-danger");
    			add_location(button1, file$8, 94, 18, 2104);
    			attr_dev(a0, "href", "#/teams");
    			add_location(a0, file$8, 94, 0, 2086);
    			attr_dev(button2, "type", "button");
    			attr_dev(button2, "class", "btn btn-primary");
    			add_location(button2, file$8, 95, 30, 2227);
    			attr_dev(a1, "href", a1_href_value = "#/events/" + /*team_id*/ ctx[0]);
    			add_location(a1, file$8, 95, 0, 2197);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h1);
    			append_dev(h1, t0);
    			append_dev(h1, t1);
    			append_dev(div, t2);
    			append_dev(div, p0);
    			append_dev(p0, t3);
    			append_dev(p0, t4);
    			append_dev(div, t5);
    			append_dev(div, p1);
    			append_dev(div, t7);
    			append_dev(div, ul);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(ul, null);
    			}

    			append_dev(div, t8);
    			append_dev(div, h2);
    			append_dev(div, t10);
    			append_dev(div, label);
    			append_dev(div, t12);
    			append_dev(div, select);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(select, null);
    			}

    			select_option(select, /*player_id*/ ctx[1]);
    			append_dev(div, t13);
    			append_dev(div, button0);
    			insert_dev(target, t15, anchor);
    			insert_dev(target, a0, anchor);
    			append_dev(a0, button1);
    			insert_dev(target, t17, anchor);
    			insert_dev(target, a1, anchor);
    			append_dev(a1, button2);

    			if (!mounted) {
    				dispose = [
    					listen_dev(select, "change", /*select_change_handler*/ ctx[7]),
    					listen_dev(button0, "click", /*addPlayerToTeam*/ ctx[4], false, false, false),
    					listen_dev(button1, "click", /*deleteTeam*/ ctx[5], false, false, false),
    					listen_dev(button2, "click", editTeam, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*team*/ 4 && t1_value !== (t1_value = /*team*/ ctx[2].name + "")) set_data_dev(t1, t1_value);
    			if (dirty & /*team*/ 4 && t4_value !== (t4_value = /*team*/ ctx[2].sportart + "")) set_data_dev(t4, t4_value);

    			if (dirty & /*team*/ 4) {
    				each_value_1 = /*team*/ ctx[2].players;
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1$1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_1$1(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_1.length;
    			}

    			if (dirty & /*players*/ 8) {
    				each_value = /*players*/ ctx[3];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$3(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$3(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(select, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*player_id, players*/ 10) {
    				select_option(select, /*player_id*/ ctx[1]);
    			}

    			if (dirty & /*team_id*/ 1 && a1_href_value !== (a1_href_value = "#/events/" + /*team_id*/ ctx[0])) {
    				attr_dev(a1, "href", a1_href_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks_1, detaching);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(t15);
    			if (detaching) detach_dev(a0);
    			if (detaching) detach_dev(t17);
    			if (detaching) detach_dev(a1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function editTeam() {
    	
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('TeamsDetail', slots, []);
    	let { params = {} } = $$props;
    	let team_id;
    	let player_id;

    	let team = {
    		_id: "",
    		name: "",
    		sportart: "",
    		players: []
    	};

    	let players = [];

    	function getTeam() {
    		axios.get("http://localhost:3001/api/teams/" + team_id).then(response => {
    			$$invalidate(2, team = response.data);
    		});
    	}

    	function getPlayers() {
    		axios.get("http://localhost:3001/api/players").then(response => {
    			$$invalidate(3, players = response.data);
    		});
    	}

    	function addPlayerToTeam() {
    		// if (player_id===team.players._id){
    		// alreadyExists()
    		// } else {
    		team.players.push(player_id);

    		axios.put("http://localhost:3001/api/teams/" + team_id, team).then(response => {
    			getTeam();
    		});
    	} //     }

    	// function alreadyExists(){
    	// alert("User already existing in current Team");
    	// }
    	function deleteTeam() {
    		axios.delete("http://localhost:3001/api/teams/" + team_id);
    		alert("Team has been succesfully deleted");
    	}

    	const writable_props = ['params'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<TeamsDetail> was created with unknown prop '${key}'`);
    	});

    	function select_change_handler() {
    		player_id = select_value(this);
    		$$invalidate(1, player_id);
    		$$invalidate(3, players);
    	}

    	$$self.$$set = $$props => {
    		if ('params' in $$props) $$invalidate(6, params = $$props.params);
    	};

    	$$self.$capture_state = () => ({
    		axios,
    		params,
    		team_id,
    		player_id,
    		team,
    		players,
    		getTeam,
    		getPlayers,
    		addPlayerToTeam,
    		deleteTeam,
    		editTeam
    	});

    	$$self.$inject_state = $$props => {
    		if ('params' in $$props) $$invalidate(6, params = $$props.params);
    		if ('team_id' in $$props) $$invalidate(0, team_id = $$props.team_id);
    		if ('player_id' in $$props) $$invalidate(1, player_id = $$props.player_id);
    		if ('team' in $$props) $$invalidate(2, team = $$props.team);
    		if ('players' in $$props) $$invalidate(3, players = $$props.players);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*params*/ 64) {
    			{
    				$$invalidate(0, team_id = params.id);
    				getTeam();
    				getPlayers();
    			}
    		}
    	};

    	return [
    		team_id,
    		player_id,
    		team,
    		players,
    		addPlayerToTeam,
    		deleteTeam,
    		params,
    		select_change_handler
    	];
    }

    class TeamsDetail extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, { params: 6 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TeamsDetail",
    			options,
    			id: create_fragment$8.name
    		});
    	}

    	get params() {
    		throw new Error("<TeamsDetail>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set params(value) {
    		throw new Error("<TeamsDetail>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\pages\Teams\CreateTeam.svelte generated by Svelte v3.48.0 */

    const { console: console_1$2 } = globals;
    const file$7 = "src\\pages\\Teams\\CreateTeam.svelte";

    function create_fragment$7(ctx) {
    	let div2;
    	let h1;
    	let t1;
    	let form;
    	let div0;
    	let label0;
    	let t3;
    	let input0;
    	let t4;
    	let div1;
    	let label1;
    	let t6;
    	let input1;
    	let t7;
    	let a;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Add a Team";
    			t1 = space();
    			form = element("form");
    			div0 = element("div");
    			label0 = element("label");
    			label0.textContent = "Name";
    			t3 = space();
    			input0 = element("input");
    			t4 = space();
    			div1 = element("div");
    			label1 = element("label");
    			label1.textContent = "Sportart";
    			t6 = space();
    			input1 = element("input");
    			t7 = space();
    			a = element("a");
    			button = element("button");
    			button.textContent = "Add Team";
    			attr_dev(h1, "class", "mt-3");
    			add_location(h1, file$7, 28, 4, 529);
    			attr_dev(label0, "for", "");
    			attr_dev(label0, "class", "form-label");
    			add_location(label0, file$7, 32, 12, 617);
    			attr_dev(input0, "class", "form-control");
    			attr_dev(input0, "type", "text");
    			add_location(input0, file$7, 33, 12, 676);
    			attr_dev(div0, "class", "mb-3");
    			add_location(div0, file$7, 31, 8, 585);
    			attr_dev(label1, "for", "");
    			attr_dev(label1, "class", "form-label");
    			add_location(label1, file$7, 36, 12, 799);
    			attr_dev(input1, "class", "form-control");
    			attr_dev(input1, "type", "text");
    			add_location(input1, file$7, 37, 12, 862);
    			attr_dev(div1, "class", "mb-3");
    			add_location(div1, file$7, 35, 8, 767);
    			attr_dev(button, "type", "button");
    			attr_dev(button, "class", "btn btn-primary");
    			add_location(button, file$7, 41, 26, 994);
    			attr_dev(a, "href", "#/teams");
    			add_location(a, file$7, 41, 7, 975);
    			add_location(form, file$7, 30, 4, 569);
    			attr_dev(div2, "class", "mb-5");
    			add_location(div2, file$7, 27, 0, 505);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, h1);
    			append_dev(div2, t1);
    			append_dev(div2, form);
    			append_dev(form, div0);
    			append_dev(div0, label0);
    			append_dev(div0, t3);
    			append_dev(div0, input0);
    			set_input_value(input0, /*team*/ ctx[0].name);
    			append_dev(form, t4);
    			append_dev(form, div1);
    			append_dev(div1, label1);
    			append_dev(div1, t6);
    			append_dev(div1, input1);
    			set_input_value(input1, /*team*/ ctx[0].sportart);
    			append_dev(form, t7);
    			append_dev(form, a);
    			append_dev(a, button);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[2]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[3]),
    					listen_dev(button, "click", /*addTeam*/ ctx[1], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*team*/ 1 && input0.value !== /*team*/ ctx[0].name) {
    				set_input_value(input0, /*team*/ ctx[0].name);
    			}

    			if (dirty & /*team*/ 1 && input1.value !== /*team*/ ctx[0].sportart) {
    				set_input_value(input1, /*team*/ ctx[0].sportart);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('CreateTeam', slots, []);
    	let team = { name: "", sportart: "", players: [] };

    	function addTeam() {
    		axios.post("http://localhost:3001/api/teams", team).then(response => {
    			alert("Team added");
    		}).catch(error => {
    			console.log(error);
    			alert(error);
    		});
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$2.warn(`<CreateTeam> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		team.name = this.value;
    		$$invalidate(0, team);
    	}

    	function input1_input_handler() {
    		team.sportart = this.value;
    		$$invalidate(0, team);
    	}

    	$$self.$capture_state = () => ({ axios, team, addTeam });

    	$$self.$inject_state = $$props => {
    		if ('team' in $$props) $$invalidate(0, team = $$props.team);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [team, addTeam, input0_input_handler, input1_input_handler];
    }

    class CreateTeam extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "CreateTeam",
    			options,
    			id: create_fragment$7.name
    		});
    	}
    }

    /* src\pages\Events\Events.svelte generated by Svelte v3.48.0 */
    const file$6 = "src\\pages\\Events\\Events.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[2] = list[i];
    	return child_ctx;
    }

    // (29:12) {#each events as event}
    function create_each_block$2(ctx) {
    	let tr;
    	let td0;
    	let t0_value = /*event*/ ctx[2].name + "";
    	let t0;
    	let t1;
    	let td1;
    	let t2_value = /*event*/ ctx[2].eventdate + "";
    	let t2;
    	let t3;
    	let td2;
    	let a;
    	let t4_value = /*event*/ ctx[2].eventinfo + "";
    	let t4;
    	let a_href_value;
    	let t5;

    	const block = {
    		c: function create() {
    			tr = element("tr");
    			td0 = element("td");
    			t0 = text(t0_value);
    			t1 = space();
    			td1 = element("td");
    			t2 = text(t2_value);
    			t3 = space();
    			td2 = element("td");
    			a = element("a");
    			t4 = text(t4_value);
    			t5 = space();
    			add_location(td0, file$6, 30, 20, 784);
    			add_location(td1, file$6, 36, 20, 953);
    			attr_dev(a, "href", a_href_value = "#/events/" + /*event*/ ctx[2]._id);
    			add_location(a, file$6, 40, 24, 1079);
    			add_location(td2, file$6, 39, 20, 1049);
    			add_location(tr, file$6, 29, 16, 758);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, tr, anchor);
    			append_dev(tr, td0);
    			append_dev(td0, t0);
    			append_dev(tr, t1);
    			append_dev(tr, td1);
    			append_dev(td1, t2);
    			append_dev(tr, t3);
    			append_dev(tr, td2);
    			append_dev(td2, a);
    			append_dev(a, t4);
    			append_dev(tr, t5);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*events*/ 1 && t0_value !== (t0_value = /*event*/ ctx[2].name + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*events*/ 1 && t2_value !== (t2_value = /*event*/ ctx[2].eventdate + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*events*/ 1 && t4_value !== (t4_value = /*event*/ ctx[2].eventinfo + "")) set_data_dev(t4, t4_value);

    			if (dirty & /*events*/ 1 && a_href_value !== (a_href_value = "#/events/" + /*event*/ ctx[2]._id)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(tr);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(29:12) {#each events as event}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let div;
    	let h1;
    	let t1;
    	let a;
    	let button;
    	let t3;
    	let table;
    	let thead;
    	let tr;
    	let th0;
    	let t5;
    	let th1;
    	let t7;
    	let th2;
    	let t9;
    	let tbody;
    	let each_value = /*events*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			h1 = element("h1");
    			h1.textContent = "List of all Events";
    			t1 = space();
    			a = element("a");
    			button = element("button");
    			button.textContent = "Add Event";
    			t3 = space();
    			table = element("table");
    			thead = element("thead");
    			tr = element("tr");
    			th0 = element("th");
    			th0.textContent = "Name";
    			t5 = space();
    			th1 = element("th");
    			th1.textContent = "Durchführungsdatum";
    			t7 = space();
    			th2 = element("th");
    			th2.textContent = "Eventinfo";
    			t9 = space();
    			tbody = element("tbody");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(h1, "class", "mt-3");
    			add_location(h1, file$6, 14, 4, 282);
    			attr_dev(button, "type", "button");
    			attr_dev(button, "class", "btn btn-primary");
    			add_location(button, file$6, 16, 29, 355);
    			attr_dev(a, "href", "#/create-event");
    			add_location(a, file$6, 16, 4, 330);
    			add_location(th0, file$6, 22, 16, 550);
    			add_location(th1, file$6, 23, 16, 581);
    			add_location(th2, file$6, 24, 16, 626);
    			add_location(tr, file$6, 20, 12, 510);
    			add_location(thead, file$6, 19, 8, 489);
    			add_location(tbody, file$6, 27, 8, 696);
    			attr_dev(table, "class", "table table-striped table-hover");
    			add_location(table, file$6, 18, 4, 432);
    			attr_dev(div, "class", "mb-5");
    			add_location(div, file$6, 13, 0, 258);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h1);
    			append_dev(div, t1);
    			append_dev(div, a);
    			append_dev(a, button);
    			append_dev(div, t3);
    			append_dev(div, table);
    			append_dev(table, thead);
    			append_dev(thead, tr);
    			append_dev(tr, th0);
    			append_dev(tr, t5);
    			append_dev(tr, th1);
    			append_dev(tr, t7);
    			append_dev(tr, th2);
    			append_dev(table, t9);
    			append_dev(table, tbody);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(tbody, null);
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*events*/ 1) {
    				each_value = /*events*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(tbody, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Events', slots, []);
    	let events = [];

    	function getEvent() {
    		axios.get("http://localhost:3001/api/events").then(response => {
    			$$invalidate(0, events = response.data);
    		});
    	}

    	getEvent();
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Events> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ axios, events, getEvent });

    	$$self.$inject_state = $$props => {
    		if ('events' in $$props) $$invalidate(0, events = $$props.events);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [events];
    }

    class Events extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Events",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* src\pages\Events\EventsDetail.svelte generated by Svelte v3.48.0 */
    const file$5 = "src\\pages\\Events\\EventsDetail.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[10] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[13] = list[i];
    	return child_ctx;
    }

    // (65:8) {#each event.teams as team}
    function create_each_block_1(ctx) {
    	let li;
    	let a;
    	let t0_value = /*team*/ ctx[13] + "";
    	let t0;
    	let a_href_value;
    	let t1;

    	const block = {
    		c: function create() {
    			li = element("li");
    			a = element("a");
    			t0 = text(t0_value);
    			t1 = space();
    			attr_dev(a, "href", a_href_value = "#/teams/" + /*team*/ ctx[13]);
    			add_location(a, file$5, 66, 16, 1497);
    			add_location(li, file$5, 65, 12, 1475);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, a);
    			append_dev(a, t0);
    			append_dev(li, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*event*/ 4 && t0_value !== (t0_value = /*team*/ ctx[13] + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*event*/ 4 && a_href_value !== (a_href_value = "#/teams/" + /*team*/ ctx[13])) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(65:8) {#each event.teams as team}",
    		ctx
    	});

    	return block;
    }

    // (75:8) {#each teams as t}
    function create_each_block$1(ctx) {
    	let option;
    	let t_value = /*t*/ ctx[10].name + "";
    	let t;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = /*t*/ ctx[10]._id;
    			option.value = option.__value;
    			add_location(option, file$5, 75, 12, 1767);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(75:8) {#each teams as t}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let div;
    	let h1;
    	let t0;
    	let t1_value = /*event*/ ctx[2].name + "";
    	let t1;
    	let t2;
    	let p0;
    	let t3;
    	let t4_value = /*event*/ ctx[2].eventdate + "";
    	let t4;
    	let t5;
    	let p1;
    	let t6;
    	let t7_value = /*event*/ ctx[2].eventinfo + "";
    	let t7;
    	let t8;
    	let p2;
    	let t10;
    	let ul;
    	let t11;
    	let h2;
    	let t13;
    	let label;
    	let t15;
    	let select;
    	let t16;
    	let button0;
    	let t18;
    	let a0;
    	let button1;
    	let t20;
    	let a1;
    	let button2;
    	let a1_href_value;
    	let mounted;
    	let dispose;
    	let each_value_1 = /*event*/ ctx[2].teams;
    	validate_each_argument(each_value_1);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	let each_value = /*teams*/ ctx[3];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			h1 = element("h1");
    			t0 = text("Event: ");
    			t1 = text(t1_value);
    			t2 = space();
    			p0 = element("p");
    			t3 = text("Durchführungsdatum: ");
    			t4 = text(t4_value);
    			t5 = space();
    			p1 = element("p");
    			t6 = text("Eventinfo: ");
    			t7 = text(t7_value);
    			t8 = space();
    			p2 = element("p");
    			p2.textContent = "Teams:";
    			t10 = space();
    			ul = element("ul");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t11 = space();
    			h2 = element("h2");
    			h2.textContent = "Update Teams";
    			t13 = space();
    			label = element("label");
    			label.textContent = "Add Team to Event";
    			t15 = space();
    			select = element("select");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t16 = space();
    			button0 = element("button");
    			button0.textContent = "Update Event";
    			t18 = space();
    			a0 = element("a");
    			button1 = element("button");
    			button1.textContent = "Delete Event";
    			t20 = space();
    			a1 = element("a");
    			button2 = element("button");
    			button2.textContent = "Edit Event";
    			attr_dev(h1, "class", "mt-3");
    			add_location(h1, file$5, 58, 4, 1256);
    			add_location(p0, file$5, 59, 4, 1303);
    			add_location(p1, file$5, 60, 4, 1353);
    			add_location(p2, file$5, 62, 4, 1401);
    			add_location(ul, file$5, 63, 4, 1420);
    			add_location(h2, file$5, 71, 4, 1590);
    			attr_dev(label, "for", "team");
    			add_location(label, file$5, 72, 4, 1617);
    			attr_dev(select, "class", "form-select");
    			attr_dev(select, "id", "team");
    			if (/*team_id*/ ctx[1] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[7].call(select));
    			add_location(select, file$5, 73, 4, 1666);
    			attr_dev(button0, "class", "btn btn-primary mt-2");
    			add_location(button0, file$5, 78, 4, 1844);
    			attr_dev(div, "class", "mb-5");
    			add_location(div, file$5, 57, 0, 1232);
    			attr_dev(button1, "type", "button");
    			attr_dev(button1, "class", "btn btn-danger");
    			add_location(button1, file$5, 80, 19, 1957);
    			attr_dev(a0, "href", "#/events");
    			add_location(a0, file$5, 80, 0, 1938);
    			attr_dev(button2, "type", "button");
    			attr_dev(button2, "class", "btn btn-primary");
    			add_location(button2, file$5, 81, 31, 2083);
    			attr_dev(a1, "href", a1_href_value = "#/events/" + /*event_id*/ ctx[0]);
    			add_location(a1, file$5, 81, 0, 2052);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h1);
    			append_dev(h1, t0);
    			append_dev(h1, t1);
    			append_dev(div, t2);
    			append_dev(div, p0);
    			append_dev(p0, t3);
    			append_dev(p0, t4);
    			append_dev(div, t5);
    			append_dev(div, p1);
    			append_dev(p1, t6);
    			append_dev(p1, t7);
    			append_dev(div, t8);
    			append_dev(div, p2);
    			append_dev(div, t10);
    			append_dev(div, ul);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(ul, null);
    			}

    			append_dev(div, t11);
    			append_dev(div, h2);
    			append_dev(div, t13);
    			append_dev(div, label);
    			append_dev(div, t15);
    			append_dev(div, select);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(select, null);
    			}

    			select_option(select, /*team_id*/ ctx[1]);
    			append_dev(div, t16);
    			append_dev(div, button0);
    			insert_dev(target, t18, anchor);
    			insert_dev(target, a0, anchor);
    			append_dev(a0, button1);
    			insert_dev(target, t20, anchor);
    			insert_dev(target, a1, anchor);
    			append_dev(a1, button2);

    			if (!mounted) {
    				dispose = [
    					listen_dev(select, "change", /*select_change_handler*/ ctx[7]),
    					listen_dev(button0, "click", /*addTeamToEvent*/ ctx[4], false, false, false),
    					listen_dev(button1, "click", /*deleteEvent*/ ctx[5], false, false, false),
    					listen_dev(button2, "click", editEvent, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*event*/ 4 && t1_value !== (t1_value = /*event*/ ctx[2].name + "")) set_data_dev(t1, t1_value);
    			if (dirty & /*event*/ 4 && t4_value !== (t4_value = /*event*/ ctx[2].eventdate + "")) set_data_dev(t4, t4_value);
    			if (dirty & /*event*/ 4 && t7_value !== (t7_value = /*event*/ ctx[2].eventinfo + "")) set_data_dev(t7, t7_value);

    			if (dirty & /*event*/ 4) {
    				each_value_1 = /*event*/ ctx[2].teams;
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_1(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_1.length;
    			}

    			if (dirty & /*teams*/ 8) {
    				each_value = /*teams*/ ctx[3];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(select, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*team_id, teams*/ 10) {
    				select_option(select, /*team_id*/ ctx[1]);
    			}

    			if (dirty & /*event_id*/ 1 && a1_href_value !== (a1_href_value = "#/events/" + /*event_id*/ ctx[0])) {
    				attr_dev(a1, "href", a1_href_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks_1, detaching);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(t18);
    			if (detaching) detach_dev(a0);
    			if (detaching) detach_dev(t20);
    			if (detaching) detach_dev(a1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function editEvent() {
    	
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('EventsDetail', slots, []);
    	let { params = {} } = $$props;
    	let event_id;
    	let team_id;

    	let event = {
    		_id: "",
    		name: "",
    		eventdate: "",
    		eventinfo: "",
    		teams: []
    	};

    	let teams = [];

    	function getEvent() {
    		axios.get("http://localhost:3001/api/events/" + event_id).then(response => {
    			$$invalidate(2, event = response.data);
    		});
    	}

    	function getTeams() {
    		axios.get("http://localhost:3001/api/teams").then(response => {
    			players = response.data;
    		});
    	}

    	function addTeamToEvent() {
    		event.teams.push(team_id);

    		axios.put("http://localhost:3001/api/events/" + event_id, event).then(response => {
    			getEvent();
    		});
    	}

    	function deleteEvent() {
    		axios.delete("http://localhost:3001/api/events/" + event_id);
    		alert("Event has been succesfully deleted");
    	}

    	const writable_props = ['params'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<EventsDetail> was created with unknown prop '${key}'`);
    	});

    	function select_change_handler() {
    		team_id = select_value(this);
    		$$invalidate(1, team_id);
    		$$invalidate(3, teams);
    	}

    	$$self.$$set = $$props => {
    		if ('params' in $$props) $$invalidate(6, params = $$props.params);
    	};

    	$$self.$capture_state = () => ({
    		axios,
    		Events,
    		params,
    		event_id,
    		team_id,
    		event,
    		teams,
    		getEvent,
    		getTeams,
    		addTeamToEvent,
    		deleteEvent,
    		editEvent
    	});

    	$$self.$inject_state = $$props => {
    		if ('params' in $$props) $$invalidate(6, params = $$props.params);
    		if ('event_id' in $$props) $$invalidate(0, event_id = $$props.event_id);
    		if ('team_id' in $$props) $$invalidate(1, team_id = $$props.team_id);
    		if ('event' in $$props) $$invalidate(2, event = $$props.event);
    		if ('teams' in $$props) $$invalidate(3, teams = $$props.teams);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*params*/ 64) {
    			{
    				$$invalidate(0, event_id = params.id);
    				getEvent();
    				getTeams();
    			}
    		}
    	};

    	return [
    		event_id,
    		team_id,
    		event,
    		teams,
    		addTeamToEvent,
    		deleteEvent,
    		params,
    		select_change_handler
    	];
    }

    class EventsDetail extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, { params: 6 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "EventsDetail",
    			options,
    			id: create_fragment$5.name
    		});
    	}

    	get params() {
    		throw new Error("<EventsDetail>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set params(value) {
    		throw new Error("<EventsDetail>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\pages\Events\CreateEvent.svelte generated by Svelte v3.48.0 */

    const { console: console_1$1 } = globals;
    const file$4 = "src\\pages\\Events\\CreateEvent.svelte";

    function create_fragment$4(ctx) {
    	let div3;
    	let h1;
    	let t1;
    	let form;
    	let div0;
    	let label0;
    	let t3;
    	let input0;
    	let t4;
    	let div1;
    	let label1;
    	let t6;
    	let input1;
    	let t7;
    	let div2;
    	let label2;
    	let t9;
    	let input2;
    	let t10;
    	let a;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Add a Event";
    			t1 = space();
    			form = element("form");
    			div0 = element("div");
    			label0 = element("label");
    			label0.textContent = "Name";
    			t3 = space();
    			input0 = element("input");
    			t4 = space();
    			div1 = element("div");
    			label1 = element("label");
    			label1.textContent = "Durchführungsdatum";
    			t6 = space();
    			input1 = element("input");
    			t7 = space();
    			div2 = element("div");
    			label2 = element("label");
    			label2.textContent = "Eventinfo";
    			t9 = space();
    			input2 = element("input");
    			t10 = space();
    			a = element("a");
    			button = element("button");
    			button.textContent = "Add Event";
    			attr_dev(h1, "class", "mt-3");
    			add_location(h1, file$4, 24, 4, 515);
    			attr_dev(label0, "for", "");
    			attr_dev(label0, "class", "form-label");
    			add_location(label0, file$4, 28, 12, 604);
    			attr_dev(input0, "class", "form-control");
    			attr_dev(input0, "type", "text");
    			add_location(input0, file$4, 29, 12, 663);
    			attr_dev(div0, "class", "mb-3");
    			add_location(div0, file$4, 27, 8, 572);
    			attr_dev(label1, "for", "");
    			attr_dev(label1, "class", "form-label");
    			add_location(label1, file$4, 32, 12, 787);
    			attr_dev(input1, "class", "form-control");
    			attr_dev(input1, "type", "date");
    			add_location(input1, file$4, 33, 12, 860);
    			attr_dev(div1, "class", "mb-3");
    			add_location(div1, file$4, 31, 8, 755);
    			attr_dev(label2, "for", "");
    			attr_dev(label2, "class", "form-label");
    			add_location(label2, file$4, 36, 12, 989);
    			attr_dev(input2, "class", "form-control");
    			attr_dev(input2, "type", "text");
    			add_location(input2, file$4, 37, 12, 1053);
    			attr_dev(div2, "class", "mb-3");
    			add_location(div2, file$4, 35, 8, 957);
    			attr_dev(button, "type", "button");
    			attr_dev(button, "class", "btn btn-primary");
    			add_location(button, file$4, 39, 26, 1168);
    			attr_dev(a, "href", "#/events");
    			add_location(a, file$4, 39, 7, 1149);
    			add_location(form, file$4, 26, 4, 556);
    			attr_dev(div3, "class", "mb-5");
    			add_location(div3, file$4, 23, 0, 491);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, h1);
    			append_dev(div3, t1);
    			append_dev(div3, form);
    			append_dev(form, div0);
    			append_dev(div0, label0);
    			append_dev(div0, t3);
    			append_dev(div0, input0);
    			set_input_value(input0, /*event*/ ctx[0].name);
    			append_dev(form, t4);
    			append_dev(form, div1);
    			append_dev(div1, label1);
    			append_dev(div1, t6);
    			append_dev(div1, input1);
    			set_input_value(input1, /*event*/ ctx[0].eventdate);
    			append_dev(form, t7);
    			append_dev(form, div2);
    			append_dev(div2, label2);
    			append_dev(div2, t9);
    			append_dev(div2, input2);
    			set_input_value(input2, /*event*/ ctx[0].eventinfo);
    			append_dev(form, t10);
    			append_dev(form, a);
    			append_dev(a, button);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[2]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[3]),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[4]),
    					listen_dev(button, "click", /*addEvent*/ ctx[1], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*event*/ 1 && input0.value !== /*event*/ ctx[0].name) {
    				set_input_value(input0, /*event*/ ctx[0].name);
    			}

    			if (dirty & /*event*/ 1) {
    				set_input_value(input1, /*event*/ ctx[0].eventdate);
    			}

    			if (dirty & /*event*/ 1 && input2.value !== /*event*/ ctx[0].eventinfo) {
    				set_input_value(input2, /*event*/ ctx[0].eventinfo);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('CreateEvent', slots, []);

    	let event = {
    		name: "",
    		eventdate: "",
    		eventinfo: "",
    		teams: []
    	};

    	function addEvent() {
    		axios.post("http://localhost:3001/api/events", event).then(response => {
    			alert("Event added");
    		}).catch(error => {
    			console.log(error);
    			alert(error);
    		});
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$1.warn(`<CreateEvent> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		event.name = this.value;
    		$$invalidate(0, event);
    	}

    	function input1_input_handler() {
    		event.eventdate = this.value;
    		$$invalidate(0, event);
    	}

    	function input2_input_handler() {
    		event.eventinfo = this.value;
    		$$invalidate(0, event);
    	}

    	$$self.$capture_state = () => ({ axios, event, addEvent });

    	$$self.$inject_state = $$props => {
    		if ('event' in $$props) $$invalidate(0, event = $$props.event);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		event,
    		addEvent,
    		input0_input_handler,
    		input1_input_handler,
    		input2_input_handler
    	];
    }

    class CreateEvent extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "CreateEvent",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src\pages\Players\Players.svelte generated by Svelte v3.48.0 */
    const file$3 = "src\\pages\\Players\\Players.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[2] = list[i];
    	return child_ctx;
    }

    // (33:12) {#each players as player}
    function create_each_block(ctx) {
    	let tr;
    	let td0;
    	let t0_value = /*player*/ ctx[2].name + "";
    	let t0;
    	let t1;
    	let td1;
    	let t2_value = /*player*/ ctx[2].gender + "";
    	let t2;
    	let t3;
    	let td2;
    	let t4_value = /*player*/ ctx[2].birthdate + "";
    	let t4;
    	let t5;
    	let td3;
    	let a;
    	let t6;
    	let a_href_value;
    	let t7;

    	const block = {
    		c: function create() {
    			tr = element("tr");
    			td0 = element("td");
    			t0 = text(t0_value);
    			t1 = space();
    			td1 = element("td");
    			t2 = text(t2_value);
    			t3 = space();
    			td2 = element("td");
    			t4 = text(t4_value);
    			t5 = space();
    			td3 = element("td");
    			a = element("a");
    			t6 = text("Details");
    			t7 = space();
    			add_location(td0, file$3, 34, 20, 836);
    			add_location(td1, file$3, 38, 24, 958);
    			add_location(td2, file$3, 41, 20, 1056);
    			attr_dev(a, "href", a_href_value = "#/players/" + /*player*/ ctx[2]._id);
    			add_location(a, file$3, 46, 24, 1185);
    			add_location(td3, file$3, 45, 20, 1155);
    			add_location(tr, file$3, 33, 16, 810);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, tr, anchor);
    			append_dev(tr, td0);
    			append_dev(td0, t0);
    			append_dev(tr, t1);
    			append_dev(tr, td1);
    			append_dev(td1, t2);
    			append_dev(tr, t3);
    			append_dev(tr, td2);
    			append_dev(td2, t4);
    			append_dev(tr, t5);
    			append_dev(tr, td3);
    			append_dev(td3, a);
    			append_dev(a, t6);
    			append_dev(tr, t7);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*players*/ 1 && t0_value !== (t0_value = /*player*/ ctx[2].name + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*players*/ 1 && t2_value !== (t2_value = /*player*/ ctx[2].gender + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*players*/ 1 && t4_value !== (t4_value = /*player*/ ctx[2].birthdate + "")) set_data_dev(t4, t4_value);

    			if (dirty & /*players*/ 1 && a_href_value !== (a_href_value = "#/players/" + /*player*/ ctx[2]._id)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(tr);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(33:12) {#each players as player}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let div;
    	let h1;
    	let t1;
    	let a;
    	let button;
    	let t3;
    	let table;
    	let thead;
    	let tr;
    	let th0;
    	let t5;
    	let th1;
    	let t7;
    	let th2;
    	let t9;
    	let th3;
    	let t11;
    	let tbody;
    	let each_value = /*players*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			h1 = element("h1");
    			h1.textContent = "List of all Players";
    			t1 = space();
    			a = element("a");
    			button = element("button");
    			button.textContent = "Add Player";
    			t3 = space();
    			table = element("table");
    			thead = element("thead");
    			tr = element("tr");
    			th0 = element("th");
    			th0.textContent = "Name";
    			t5 = space();
    			th1 = element("th");
    			th1.textContent = "Gender";
    			t7 = space();
    			th2 = element("th");
    			th2.textContent = "Birthdate";
    			t9 = space();
    			th3 = element("th");
    			th3.textContent = "Player Details";
    			t11 = space();
    			tbody = element("tbody");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(h1, "class", "mt-3");
    			add_location(h1, file$3, 17, 4, 301);
    			attr_dev(button, "type", "button");
    			attr_dev(button, "class", "btn btn-primary");
    			add_location(button, file$3, 19, 30, 380);
    			attr_dev(a, "href", "#/create-player");
    			add_location(a, file$3, 19, 4, 354);
    			add_location(th0, file$3, 25, 16, 576);
    			add_location(th1, file$3, 26, 16, 607);
    			add_location(th2, file$3, 27, 16, 640);
    			add_location(th3, file$3, 28, 16, 676);
    			add_location(tr, file$3, 23, 12, 536);
    			add_location(thead, file$3, 22, 8, 515);
    			add_location(tbody, file$3, 31, 8, 746);
    			attr_dev(table, "class", "table table-striped table-hover");
    			add_location(table, file$3, 21, 4, 458);
    			attr_dev(div, "class", "mb-5");
    			add_location(div, file$3, 16, 0, 277);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h1);
    			append_dev(div, t1);
    			append_dev(div, a);
    			append_dev(a, button);
    			append_dev(div, t3);
    			append_dev(div, table);
    			append_dev(table, thead);
    			append_dev(thead, tr);
    			append_dev(tr, th0);
    			append_dev(tr, t5);
    			append_dev(tr, th1);
    			append_dev(tr, t7);
    			append_dev(tr, th2);
    			append_dev(tr, t9);
    			append_dev(tr, th3);
    			append_dev(table, t11);
    			append_dev(table, tbody);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(tbody, null);
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*players*/ 1) {
    				each_value = /*players*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(tbody, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Players', slots, []);
    	let players = [];

    	function getPlayers() {
    		axios.get("http://localhost:3001/api/players").then(response => {
    			$$invalidate(0, players = response.data);
    		});
    	}

    	getPlayers();
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Players> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ axios, players, getPlayers });

    	$$self.$inject_state = $$props => {
    		if ('players' in $$props) $$invalidate(0, players = $$props.players);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [players];
    }

    class Players extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Players",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src\pages\Players\PlayersDetail.svelte generated by Svelte v3.48.0 */
    const file$2 = "src\\pages\\Players\\PlayersDetail.svelte";

    function create_fragment$2(ctx) {
    	let div;
    	let h1;
    	let t0;
    	let t1_value = /*player*/ ctx[1].name + "";
    	let t1;
    	let t2;
    	let p0;
    	let t3;
    	let t4;
    	let t5;
    	let p1;
    	let t6;
    	let t7_value = /*player*/ ctx[1].gender + "";
    	let t7;
    	let t8;
    	let p2;
    	let t9;
    	let t10_value = /*player*/ ctx[1].birthdate + "";
    	let t10;
    	let t11;
    	let a0;
    	let button0;
    	let t13;
    	let a1;
    	let button1;
    	let a1_href_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h1 = element("h1");
    			t0 = text("Player Name: ");
    			t1 = text(t1_value);
    			t2 = space();
    			p0 = element("p");
    			t3 = text("ID: ");
    			t4 = text(/*id*/ ctx[0]);
    			t5 = space();
    			p1 = element("p");
    			t6 = text("Gender: ");
    			t7 = text(t7_value);
    			t8 = space();
    			p2 = element("p");
    			t9 = text("Birthdate: ");
    			t10 = text(t10_value);
    			t11 = space();
    			a0 = element("a");
    			button0 = element("button");
    			button0.textContent = "Delete Player";
    			t13 = space();
    			a1 = element("a");
    			button1 = element("button");
    			button1.textContent = "Edit Player";
    			attr_dev(h1, "class", "mt-3");
    			add_location(h1, file$2, 36, 4, 796);
    			add_location(p0, file$2, 37, 4, 850);
    			add_location(p1, file$2, 38, 4, 871);
    			add_location(p2, file$2, 39, 4, 907);
    			attr_dev(div, "class", "mb-5");
    			add_location(div, file$2, 35, 0, 772);
    			attr_dev(button0, "type", "button");
    			attr_dev(button0, "class", "btn btn-danger");
    			add_location(button0, file$2, 43, 20, 981);
    			attr_dev(a0, "href", "#/players");
    			add_location(a0, file$2, 43, 0, 961);
    			attr_dev(button1, "type", "button");
    			attr_dev(button1, "class", "btn btn-primary");
    			add_location(button1, file$2, 44, 25, 1103);
    			attr_dev(a1, "href", a1_href_value = "#/players" + /*id*/ ctx[0]);
    			add_location(a1, file$2, 44, 0, 1078);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h1);
    			append_dev(h1, t0);
    			append_dev(h1, t1);
    			append_dev(div, t2);
    			append_dev(div, p0);
    			append_dev(p0, t3);
    			append_dev(p0, t4);
    			append_dev(div, t5);
    			append_dev(div, p1);
    			append_dev(p1, t6);
    			append_dev(p1, t7);
    			append_dev(div, t8);
    			append_dev(div, p2);
    			append_dev(p2, t9);
    			append_dev(p2, t10);
    			insert_dev(target, t11, anchor);
    			insert_dev(target, a0, anchor);
    			append_dev(a0, button0);
    			insert_dev(target, t13, anchor);
    			insert_dev(target, a1, anchor);
    			append_dev(a1, button1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*deletePlayer*/ ctx[2], false, false, false),
    					listen_dev(button1, "click", editPlayer, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*player*/ 2 && t1_value !== (t1_value = /*player*/ ctx[1].name + "")) set_data_dev(t1, t1_value);
    			if (dirty & /*id*/ 1) set_data_dev(t4, /*id*/ ctx[0]);
    			if (dirty & /*player*/ 2 && t7_value !== (t7_value = /*player*/ ctx[1].gender + "")) set_data_dev(t7, t7_value);
    			if (dirty & /*player*/ 2 && t10_value !== (t10_value = /*player*/ ctx[1].birthdate + "")) set_data_dev(t10, t10_value);

    			if (dirty & /*id*/ 1 && a1_href_value !== (a1_href_value = "#/players" + /*id*/ ctx[0])) {
    				attr_dev(a1, "href", a1_href_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t11);
    			if (detaching) detach_dev(a0);
    			if (detaching) detach_dev(t13);
    			if (detaching) detach_dev(a1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function editPlayer() {
    	
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('PlayersDetail', slots, []);
    	let { params = {} } = $$props;
    	let id;

    	function deletePlayer() {
    		axios.delete("http://localhost:3001/api/players/" + id);
    		alert("Player has been succesfully deleted");
    	}

    	let player = {};

    	function getPlayer() {
    		axios.get("http://localhost:3001/api/players/" + id).then(response => {
    			$$invalidate(1, player = response.data);
    		});
    	}

    	const writable_props = ['params'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<PlayersDetail> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('params' in $$props) $$invalidate(3, params = $$props.params);
    	};

    	$$self.$capture_state = () => ({
    		axios,
    		params,
    		id,
    		deletePlayer,
    		editPlayer,
    		player,
    		getPlayer
    	});

    	$$self.$inject_state = $$props => {
    		if ('params' in $$props) $$invalidate(3, params = $$props.params);
    		if ('id' in $$props) $$invalidate(0, id = $$props.id);
    		if ('player' in $$props) $$invalidate(1, player = $$props.player);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*params*/ 8) {
    			{
    				// "Reactive Statement":
    				// This block of is executed whenever the value of a variable in it changes.
    				// See https://svelte.dev/tutorial/reactive-statements
    				$$invalidate(0, id = params.id);

    				getPlayer();
    			}
    		}
    	};

    	return [id, player, deletePlayer, params];
    }

    class PlayersDetail extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { params: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "PlayersDetail",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get params() {
    		throw new Error("<PlayersDetail>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set params(value) {
    		throw new Error("<PlayersDetail>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\pages\Players\CreatePlayer.svelte generated by Svelte v3.48.0 */

    const { console: console_1 } = globals;
    const file$1 = "src\\pages\\Players\\CreatePlayer.svelte";

    function create_fragment$1(ctx) {
    	let div3;
    	let h1;
    	let t1;
    	let form;
    	let div0;
    	let label0;
    	let t3;
    	let input0;
    	let t4;
    	let div1;
    	let label1;
    	let t6;
    	let input1;
    	let t7;
    	let div2;
    	let label2;
    	let t9;
    	let input2;
    	let t10;
    	let a;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Add a Player";
    			t1 = space();
    			form = element("form");
    			div0 = element("div");
    			label0 = element("label");
    			label0.textContent = "Name";
    			t3 = space();
    			input0 = element("input");
    			t4 = space();
    			div1 = element("div");
    			label1 = element("label");
    			label1.textContent = "Gender";
    			t6 = space();
    			input1 = element("input");
    			t7 = space();
    			div2 = element("div");
    			label2 = element("label");
    			label2.textContent = "Birthdate";
    			t9 = space();
    			input2 = element("input");
    			t10 = space();
    			a = element("a");
    			button = element("button");
    			button.textContent = "Add Player";
    			attr_dev(h1, "class", "mt-3");
    			add_location(h1, file$1, 28, 4, 591);
    			attr_dev(label0, "for", "");
    			attr_dev(label0, "class", "form-label");
    			add_location(label0, file$1, 32, 12, 681);
    			attr_dev(input0, "class", "form-control");
    			attr_dev(input0, "type", "text");
    			add_location(input0, file$1, 33, 12, 740);
    			attr_dev(div0, "class", "mb-3");
    			add_location(div0, file$1, 31, 8, 649);
    			attr_dev(label1, "for", "");
    			attr_dev(label1, "class", "form-label");
    			add_location(label1, file$1, 36, 12, 865);
    			attr_dev(input1, "class", "form-control");
    			attr_dev(input1, "type", "text");
    			add_location(input1, file$1, 37, 12, 926);
    			attr_dev(div1, "class", "mb-3");
    			add_location(div1, file$1, 35, 8, 833);
    			attr_dev(label2, "for", "");
    			attr_dev(label2, "class", "form-label");
    			add_location(label2, file$1, 44, 12, 1117);
    			attr_dev(input2, "class", "form-control");
    			attr_dev(input2, "type", "date");
    			add_location(input2, file$1, 45, 12, 1181);
    			attr_dev(div2, "class", "mb-3");
    			add_location(div2, file$1, 43, 8, 1085);
    			attr_dev(button, "type", "button");
    			attr_dev(button, "class", "btn btn-primary");
    			add_location(button, file$1, 52, 13, 1377);
    			attr_dev(a, "href", "#/players");
    			add_location(a, file$1, 51, 8, 1343);
    			add_location(form, file$1, 30, 4, 633);
    			attr_dev(div3, "class", "mb-5");
    			add_location(div3, file$1, 27, 0, 567);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, h1);
    			append_dev(div3, t1);
    			append_dev(div3, form);
    			append_dev(form, div0);
    			append_dev(div0, label0);
    			append_dev(div0, t3);
    			append_dev(div0, input0);
    			set_input_value(input0, /*player*/ ctx[0].name);
    			append_dev(form, t4);
    			append_dev(form, div1);
    			append_dev(div1, label1);
    			append_dev(div1, t6);
    			append_dev(div1, input1);
    			set_input_value(input1, /*player*/ ctx[0].gender);
    			append_dev(form, t7);
    			append_dev(form, div2);
    			append_dev(div2, label2);
    			append_dev(div2, t9);
    			append_dev(div2, input2);
    			set_input_value(input2, /*player*/ ctx[0].birthdate);
    			append_dev(form, t10);
    			append_dev(form, a);
    			append_dev(a, button);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[2]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[3]),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[4]),
    					listen_dev(button, "click", /*addPlayer*/ ctx[1], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*player*/ 1 && input0.value !== /*player*/ ctx[0].name) {
    				set_input_value(input0, /*player*/ ctx[0].name);
    			}

    			if (dirty & /*player*/ 1 && input1.value !== /*player*/ ctx[0].gender) {
    				set_input_value(input1, /*player*/ ctx[0].gender);
    			}

    			if (dirty & /*player*/ 1) {
    				set_input_value(input2, /*player*/ ctx[0].birthdate);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function loadFile(e) {
    	src = URL.createObjectURL(e.target.files[0]);
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('CreatePlayer', slots, []);
    	let player = { name: "", gender: "", birthdate: "" };

    	function addPlayer() {
    		axios.post("http://localhost:3001/api/players", player).then(response => {
    			alert("Player added");
    		}).catch(error => {
    			console.log(error);
    			alert(error);
    		});
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<CreatePlayer> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		player.name = this.value;
    		$$invalidate(0, player);
    	}

    	function input1_input_handler() {
    		player.gender = this.value;
    		$$invalidate(0, player);
    	}

    	function input2_input_handler() {
    		player.birthdate = this.value;
    		$$invalidate(0, player);
    	}

    	$$self.$capture_state = () => ({ axios, player, addPlayer, loadFile });

    	$$self.$inject_state = $$props => {
    		if ('player' in $$props) $$invalidate(0, player = $$props.player);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		player,
    		addPlayer,
    		input0_input_handler,
    		input1_input_handler,
    		input2_input_handler
    	];
    }

    class CreatePlayer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "CreatePlayer",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    // Pages


    var routes = {
        // Home
        '/': Home,
        '/home': Home,

        // Teams
        '/teams': Teams,
        '/teams/:id': TeamsDetail,
        '/create-team': CreateTeam,
        
        // Players
        '/players': Players,
        '/players/:id':PlayersDetail,
        '/create-player': CreatePlayer,

        //Events
        '/events': Events,
        '/events/:id' : EventsDetail,
        '/create-event': CreateEvent,
    };

    /* src\App.svelte generated by Svelte v3.48.0 */
    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	let nav;
    	let div1;
    	let a0;
    	let img;
    	let img_src_value;
    	let t0;
    	let t1;
    	let button;
    	let span;
    	let t2;
    	let div0;
    	let ul3;
    	let li2;
    	let a1;
    	let t4;
    	let ul0;
    	let li0;
    	let a2;
    	let t6;
    	let li1;
    	let a3;
    	let t8;
    	let li5;
    	let a4;
    	let t10;
    	let ul1;
    	let li3;
    	let a5;
    	let t12;
    	let li4;
    	let a6;
    	let t14;
    	let li8;
    	let a7;
    	let t16;
    	let ul2;
    	let li6;
    	let a8;
    	let t18;
    	let li7;
    	let a9;
    	let t20;
    	let div2;
    	let router;
    	let current;
    	router = new Router({ props: { routes }, $$inline: true });

    	const block = {
    		c: function create() {
    			nav = element("nav");
    			div1 = element("div");
    			a0 = element("a");
    			img = element("img");
    			t0 = text("\r\n\t  Grümpi Organisator");
    			t1 = space();
    			button = element("button");
    			span = element("span");
    			t2 = space();
    			div0 = element("div");
    			ul3 = element("ul");
    			li2 = element("li");
    			a1 = element("a");
    			a1.textContent = "Players";
    			t4 = space();
    			ul0 = element("ul");
    			li0 = element("li");
    			a2 = element("a");
    			a2.textContent = "Player Overview";
    			t6 = space();
    			li1 = element("li");
    			a3 = element("a");
    			a3.textContent = "Add Player";
    			t8 = space();
    			li5 = element("li");
    			a4 = element("a");
    			a4.textContent = "Teams";
    			t10 = space();
    			ul1 = element("ul");
    			li3 = element("li");
    			a5 = element("a");
    			a5.textContent = "Teams Overview";
    			t12 = space();
    			li4 = element("li");
    			a6 = element("a");
    			a6.textContent = "Add Team";
    			t14 = space();
    			li8 = element("li");
    			a7 = element("a");
    			a7.textContent = "Events";
    			t16 = space();
    			ul2 = element("ul");
    			li6 = element("li");
    			a8 = element("a");
    			a8.textContent = "Events Overview";
    			t18 = space();
    			li7 = element("li");
    			a9 = element("a");
    			a9.textContent = "Add Events";
    			t20 = space();
    			div2 = element("div");
    			create_component(router.$$.fragment);
    			if (!src_url_equal(img.src, img_src_value = "/images/sport2.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			attr_dev(img, "width", "30");
    			attr_dev(img, "height", "24");
    			attr_dev(img, "class", "d-inline-block align-text-top");
    			add_location(img, file, 9, 1, 283);
    			attr_dev(a0, "class", "navbar-brand");
    			attr_dev(a0, "href", "#/");
    			add_location(a0, file, 8, 2, 246);
    			attr_dev(span, "class", "navbar-toggler-icon");
    			add_location(span, file, 13, 2, 625);
    			attr_dev(button, "class", "navbar-toggler");
    			attr_dev(button, "type", "button");
    			attr_dev(button, "data-bs-toggle", "collapse");
    			attr_dev(button, "data-bs-target", "#navbarSupportedContent");
    			attr_dev(button, "aria-controls", "navbarSupportedContent");
    			attr_dev(button, "aria-expanded", "false");
    			attr_dev(button, "aria-label", "Toggle navigation");
    			add_location(button, file, 12, 3, 417);
    			attr_dev(a1, "class", "nav-link dropdown-toggle");
    			attr_dev(a1, "href", "#/");
    			attr_dev(a1, "id", "navbarDropdown");
    			attr_dev(a1, "role", "button");
    			attr_dev(a1, "data-bs-toggle", "dropdown");
    			attr_dev(a1, "aria-expanded", "false");
    			add_location(a1, file, 19, 3, 844);
    			attr_dev(a2, "class", "dropdown-item");
    			attr_dev(a2, "href", "#/players");
    			add_location(a2, file, 23, 9, 1070);
    			add_location(li0, file, 23, 5, 1066);
    			attr_dev(a3, "class", "dropdown-item");
    			attr_dev(a3, "href", "#/create-player");
    			add_location(a3, file, 24, 9, 1147);
    			add_location(li1, file, 24, 5, 1143);
    			attr_dev(ul0, "class", "dropdown-menu");
    			attr_dev(ul0, "aria-labelledby", "navbarDropdown");
    			add_location(ul0, file, 22, 3, 1000);
    			attr_dev(li2, "class", "nav-item dropdown");
    			add_location(li2, file, 18, 4, 809);
    			attr_dev(a4, "class", "nav-link dropdown-toggle");
    			attr_dev(a4, "href", "#/teams");
    			attr_dev(a4, "id", "navbarDropdown");
    			attr_dev(a4, "role", "button");
    			attr_dev(a4, "data-bs-toggle", "dropdown");
    			attr_dev(a4, "aria-expanded", "false");
    			add_location(a4, file, 29, 3, 1282);
    			attr_dev(a5, "class", "dropdown-item");
    			attr_dev(a5, "href", "#/teams");
    			add_location(a5, file, 33, 9, 1511);
    			add_location(li3, file, 33, 5, 1507);
    			attr_dev(a6, "class", "dropdown-item");
    			attr_dev(a6, "href", "#/create-team");
    			add_location(a6, file, 34, 9, 1585);
    			add_location(li4, file, 34, 5, 1581);
    			attr_dev(ul1, "class", "dropdown-menu");
    			attr_dev(ul1, "aria-labelledby", "navbarDropdown");
    			add_location(ul1, file, 32, 3, 1441);
    			attr_dev(li5, "class", "nav-item dropdown");
    			add_location(li5, file, 28, 4, 1247);
    			attr_dev(a7, "class", "nav-link dropdown-toggle");
    			attr_dev(a7, "href", "#/teams");
    			attr_dev(a7, "id", "navbarDropdown");
    			attr_dev(a7, "role", "button");
    			attr_dev(a7, "data-bs-toggle", "dropdown");
    			attr_dev(a7, "aria-expanded", "false");
    			add_location(a7, file, 39, 3, 1718);
    			attr_dev(a8, "class", "dropdown-item");
    			attr_dev(a8, "href", "#/events");
    			add_location(a8, file, 43, 9, 1948);
    			add_location(li6, file, 43, 5, 1944);
    			attr_dev(a9, "class", "dropdown-item");
    			attr_dev(a9, "href", "#/create-event");
    			add_location(a9, file, 44, 9, 2024);
    			add_location(li7, file, 44, 5, 2020);
    			attr_dev(ul2, "class", "dropdown-menu");
    			attr_dev(ul2, "aria-labelledby", "navbarDropdown");
    			add_location(ul2, file, 42, 3, 1878);
    			attr_dev(li8, "class", "nav-item dropdown");
    			add_location(li8, file, 38, 4, 1683);
    			attr_dev(ul3, "class", "navbar-nav me-auto mb-2 mb-lg-0");
    			add_location(ul3, file, 16, 2, 755);
    			attr_dev(div0, "class", "collapse navbar-collapse");
    			attr_dev(div0, "id", "navbarSupportedContent");
    			add_location(div0, file, 15, 3, 685);
    			attr_dev(div1, "class", "container-fluid");
    			add_location(div1, file, 7, 1, 213);
    			attr_dev(nav, "class", "navbar navbar-expand-lg");
    			set_style(nav, "background-color", "#e3f2fd");
    			add_location(nav, file, 6, 0, 138);
    			attr_dev(div2, "class", "container mt-3");
    			add_location(div2, file, 53, 0, 2160);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, nav, anchor);
    			append_dev(nav, div1);
    			append_dev(div1, a0);
    			append_dev(a0, img);
    			append_dev(a0, t0);
    			append_dev(div1, t1);
    			append_dev(div1, button);
    			append_dev(button, span);
    			append_dev(div1, t2);
    			append_dev(div1, div0);
    			append_dev(div0, ul3);
    			append_dev(ul3, li2);
    			append_dev(li2, a1);
    			append_dev(li2, t4);
    			append_dev(li2, ul0);
    			append_dev(ul0, li0);
    			append_dev(li0, a2);
    			append_dev(ul0, t6);
    			append_dev(ul0, li1);
    			append_dev(li1, a3);
    			append_dev(ul3, t8);
    			append_dev(ul3, li5);
    			append_dev(li5, a4);
    			append_dev(li5, t10);
    			append_dev(li5, ul1);
    			append_dev(ul1, li3);
    			append_dev(li3, a5);
    			append_dev(ul1, t12);
    			append_dev(ul1, li4);
    			append_dev(li4, a6);
    			append_dev(ul3, t14);
    			append_dev(ul3, li8);
    			append_dev(li8, a7);
    			append_dev(li8, t16);
    			append_dev(li8, ul2);
    			append_dev(ul2, li6);
    			append_dev(li6, a8);
    			append_dev(ul2, t18);
    			append_dev(ul2, li7);
    			append_dev(li7, a9);
    			insert_dev(target, t20, anchor);
    			insert_dev(target, div2, anchor);
    			mount_component(router, div2, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(router.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(router.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(nav);
    			if (detaching) detach_dev(t20);
    			if (detaching) detach_dev(div2);
    			destroy_component(router);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Router, routes });
    	return [];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
