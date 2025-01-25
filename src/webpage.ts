"use strict";
!(function () {
    const e = window.fetch, t = window.XMLHttpRequest;
    window.XMLHttpRequest = function () {
        const e = new t();
        let r = null;
        const s = {
            method: null,
            requestUrl: null,
            headers: null,
            allOpenArgs: null,
        }, n = e.open, o = e.send, i = e.setRequestHeader;
        return ((e.open = function (...t) {
            return ((s.allOpenArgs = t),
                (s.method = t[0]),
                (s.requestUrl = t[1]),
                (s.headers = new Map()),
                n.apply(e, t));
        }),
            (e.setRequestHeader = function (t, r) {
                return s.headers.set(t, r), i.apply(e, [t, r]);
            }),
            (e.send = function (t) {
                try {
                    const n = e.onreadystatechange;
                    e.onreadystatechange = function () {
                        4 == e.readyState &&
                            r.intercepted &&
                            (function (e, t) {
                                Object.defineProperties(e, {
                                    response: {
                                        value: t.body,
                                        writable: !0,
                                        enumerable: !0,
                                        configurable: !0,
                                    },
                                    responseText: {
                                        value: t.responseText,
                                        writable: !0,
                                        enumerable: !0,
                                        configurable: !0,
                                    },
                                    status: {
                                        value: t.status,
                                        writable: !0,
                                        enumerable: !0,
                                        configurable: !0,
                                    },
                                    statusText: {
                                        value: t.statusText,
                                        writable: !0,
                                        enumerable: !0,
                                        configurable: !0,
                                    },
                                });
                            })(e, r.plaintextResponse),
                            n && n.call(e);
                    };
                    const i = {
                        timeout: e.timeout,
                        withCredentials: e.withCredentials,
                        responseType: e.responseType,
                        allOpenArgs: s.allOpenArgs,
                    };
                    u([
                        s.requestUrl,
                        { method: s.method, headers: s.headers, body: t },
                        i,
                    ], "XHR", i)
                        .then((s) => ((r = s), o.call(e, t)))
                        .catch(() => o.call(e, t));
                }
                catch {
                    return o.call(e, t);
                }
            }),
            e);
    };
    const r = new Map(), s = new Map(), n = new Map();
    let o = 1e4;
    const i = document.documentElement.getAttribute("data-odi-sessionId");
    let a;
    async function u(e, t, r) {
        await (async function () {
            if (!a) {
                const e = await l({
                    action: "getAppRule",
                    id: crypto.randomUUID(),
                    appUrl: window.location.href,
                });
                (a = e.appRule), (o = e.requestTimeoutLength);
            }
        })();
        const { requiresInterception: s, requestCategorizations: n } = (function (e) {
            const t = e[0], r = e[1] || {};
            if (a.isProhibitedApp)
                return {
                    errored: !0,
                    requiresInterception: !1,
                    requestCategorizations: [
                        {
                            appRuleApplies: !1,
                            isJsonRpcCall: !1,
                            requiresRequestAlteration: !1,
                            requiresResponseAlteration: !1,
                            requiresRequestRedirection: !1,
                        },
                    ],
                };
            const s = a.appSpecificRequestAlterationRules.some((e) => new RegExp(e).test(t)), n = a.appSpecificResponseAlterationRules.some((e) => new RegExp(e).test(t)), o = a.appSpecificRequestRedirectRules.some((e) => new RegExp(e).test(t));
            if (s || o || n)
                return {
                    errored: !1,
                    requiresInterception: !0,
                    requestCategorizations: [
                        {
                            appRuleApplies: !0,
                            isJsonRpcCall: !1,
                            requiresRequestAlteration: s,
                            requiresResponseAlteration: n,
                            requiresRequestRedirection: o,
                        },
                    ],
                };
            if (!r || !r.body)
                return {
                    errored: !1,
                    requiresInterception: !1,
                    requestCategorizations: [
                        {
                            appRuleApplies: !1,
                            isJsonRpcCall: !1,
                            requiresRequestAlteration: !1,
                            requiresResponseAlteration: !1,
                            requiresRequestRedirection: !1,
                        },
                    ],
                };
            try {
                const e = JSON.parse(y(r.body));
                if (Array.isArray(e)) {
                    const t = e.map((e) => d(e));
                    return {
                        errored: !1,
                        requiresInterception: t.some((e) => e.appRuleApplies),
                        requestCategorizations: t,
                    };
                }
                {
                    const t = d(e);
                    return {
                        errored: !1,
                        requiresInterception: t.appRuleApplies,
                        requestCategorizations: [t],
                    };
                }
            }
            catch (e) {
                return (console.error(e),
                    {
                        errored: !0,
                        requiresInterception: !1,
                        requestCategorizations: [
                            {
                                appRuleApplies: !1,
                                isJsonRpcCall: !1,
                                requiresRequestAlteration: !1,
                                requiresResponseAlteration: !1,
                                requiresRequestRedirection: !1,
                            },
                        ],
                    });
            }
        })(e);
        let i;
        return (s &&
            (i = await (async function (e, t, r, s) {
                if (r.length <= 1)
                    return await c(e, t, r[0], s);
                if ((function (e) {
                    return ((e.every((e) => e.appRuleApplies) &&
                        e.every((e) => e.isJsonRpcCall)) ||
                        (e.every((e) => !e.appRuleApplies) &&
                            e.every((e) => !e.isJsonRpcCall)));
                })(r)) {
                    let n = {
                        appRuleApplies: r.every((e) => e.appRuleApplies),
                        isJsonRpcCall: r.every((e) => e.isJsonRpcCall),
                        requiresRequestAlteration: r.every((e) => e.requiresRequestAlteration),
                        requiresRequestRedirection: r.every((e) => e.requiresRequestRedirection),
                        requiresResponseAlteration: r.every((e) => e.requiresResponseAlteration),
                    };
                    return await c(e, t, n, s);
                }
                return await (async function (e, t, r, s) {
                    const n = e[1] || {}, o = JSON.parse(y(n.body)), i = r.map(async (r, n) => {
                        const i = JSON.parse(JSON.stringify(e));
                        return ((i[1] = { ...i[1], body: JSON.stringify([o[n]]) }),
                            await c(i, t, r, s));
                    }), a = await Promise.all(i), u = a.map(async (e) => e.body[0]), p = await Promise.all(u);
                    return { ...a[0], body: p };
                })(e, t, r, s);
            })(e, t, n, r)),
            { intercepted: s, plaintextResponse: i });
    }
    async function c(t, n, o, i) {
        let a;
        if (o.requiresRequestAlteration) {
            const e = await (async function (e) {
                const t = await l({
                    action: "alterRequest",
                    id: crypto.randomUUID(),
                    appUrl: window.location.href,
                    request: e,
                });
                t.success &&
                    t.response &&
                    (t.response.body.requestUrl && (e[0] = t.response.body.requestUrl),
                        t.response.body.requestBody &&
                            (e[1].body = t.response.body.requestBody.body));
                return e;
            })(t);
            a = await p(e, n, i);
        }
        else
            a = o.requiresRequestRedirection
                ? await (async function (t, n, o, i) {
                    let a = { isJsonRpcCall: o.isJsonRpcCall };
                    o.isJsonRpcCall &&
                        (a.rpcChainId = await (async function (t) {
                            try {
                                if (r.has(t))
                                    return r.get(t);
                                if (s.has(t))
                                    return s.get(t);
                                const n = (async () => {
                                    const n = await e(t, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                            id: Math.floor(1e3 * Math.random()) + 1,
                                            jsonrpc: "2.0",
                                            method: "eth_chainId",
                                            params: [],
                                        }),
                                    }), o = await n.json();
                                    return r.set(t, o.result), s.delete(t), o.result;
                                })();
                                return s.set(t, n), n;
                            }
                            catch (e) {
                                throw (s.delete(t), e);
                            }
                        })(t[0]));
                    const u = await l({
                        action: "redirectRequest",
                        id: crypto.randomUUID(),
                        appUrl: window.location.href,
                        request: t,
                        ...a,
                    }, i.signal);
                    if (u.success) {
                        if (u.success && "FETCH" === n)
                            return u.response;
                        return { ...(await p(t, n, i)), body: u.response.body };
                    }
                    return await p(t, n, i);
                })(t, n, o, i)
                : await p(t, n, i);
        let u = await (async function (e, t, r, s) {
            if (r.requiresResponseAlteration) {
                const r = await l({
                    action: "alterResponse",
                    id: crypto.randomUUID(),
                    appUrl: window.location.href,
                    request: [e[0], t.body, e],
                }, s.signal);
                if (r.success)
                    return { ...t, body: r.response.body };
            }
            return t;
        })(t, a, o, i);
        return ("XHR" == n &&
            (function (e) {
                try {
                    switch ((e.response === e.responseText && (e.responseText = e.body),
                        e.responseType)) {
                        case "":
                        case "text":
                            return void ("string" != typeof e.body && (e.body = JSON.stringify(e.body)));
                        case "json":
                            return void ("string" == typeof body && (e.body = JSON.parse(e.body)));
                        case "arraybuffer":
                            if (e.body instanceof ArrayBuffer)
                                return;
                            if ("string" == typeof e.body) {
                                const t = new TextEncoder();
                                e.body = t.encode(e.body).buffer;
                            }
                            else if ("object" == typeof e.body) {
                                const t = JSON.stringify(e.body), r = new TextEncoder();
                                e.body = r.encode(t).buffer;
                            }
                            return;
                        case "blob":
                            if (e.body instanceof Blob)
                                return;
                            return void ("string" == typeof e.body
                                ? (e.body = new Blob([e.body], { type: "text/plain" }))
                                : "object" == typeof e.body &&
                                    (e.body = new Blob([JSON.stringify(e.body)], {
                                        type: "application/json",
                                    })));
                        case "document":
                            if (e.body instanceof Document)
                                return;
                            if ("string" == typeof e.body) {
                                const t = new DOMParser();
                                e.body = t.parseFromString(e.body, "text/html");
                            }
                            return;
                        default:
                            return;
                    }
                }
                catch (e) {
                    return void console.error("Error converting response body:", e);
                }
            })(u),
            u);
    }
    async function p(e, r, s) {
        return "FETCH" == r
            ? await (async function (e, t) {
                const { target: r, thisArg: s, signal: n } = t;
                e && e.length > 1 && (e[1] = { ...e[1], signal: n });
                const o = await Reflect.apply(r, s, e), i = await o.json();
                return {
                    headers: [...o.headers.entries()],
                    status: o.status,
                    statusText: o.statusText,
                    body: i,
                };
            })(e, s)
            : "XHR" == r
                ? await (async function (e, r) {
                    return new Promise((s, n) => {
                        const o = new t();
                        (o.onreadystatechange = function () {
                            var e;
                            4 === o.readyState &&
                                s({
                                    body: (e = o).response,
                                    response: e.response,
                                    responseText: e.responseText,
                                    responseType: e.responseType,
                                    responseURL: e.responseURL,
                                    responseXML: e.responseXML,
                                    readyState: e.readyState,
                                    status: e.status,
                                    statusText: e.statusText,
                                    getAllResponseHeaders: e.getAllResponseHeaders(),
                                    timeout: e.timeout,
                                    withCredentials: e.withCredentials,
                                    upload: e.upload,
                                });
                        }),
                            (o.onerror = () => {
                                n(new Error("Network error occurred"));
                            }),
                            (o.timeout = r.timeout),
                            (o.withCredentials = r.withCredentials),
                            (o.responseType = r.responseType),
                            o.open(...r.allOpenArgs),
                            e[1].headers.forEach((e, t) => {
                                o.setRequestHeader(t, e);
                            }),
                            e[1].body ? o.send(e[1].body) : o.send();
                    });
                })(e, s)
                : void 0;
    }
    function l(e, t) {
        return new Promise((r, s) => {
            const a = setTimeout(() => (function (e) {
                if (n.has(e.id)) {
                    const { reject: t } = n.get(e.id);
                    t(new Error("Request timed out")), n.delete(e.id);
                }
            })(e), o);
            n.set(e.id, { resolve: r, reject: s, timeOut: a }),
                t &&
                    (t.addEventListener("abort", () => (function (e) {
                        if (n.has(e.id)) {
                            const { reject: t } = n.get(e.id);
                            t(new DOMException("Request was aborted", "AbortError")),
                                n.delete(e.id);
                        }
                    })(e), { once: !0 }),
                        e.request && e.request.length > 1 && delete e.request[1].signal),
                window.postMessage({ type: "ODI_REQUEST", sessionId: i, ...e }, window.location.origin);
        });
    }
    function d(e) {
        const t = e.hasOwnProperty("jsonrpc") && void 0 !== e.jsonrpc, r = t && a.rpcRedirectRules.includes(e.method);
        return {
            appRuleApplies: r,
            isJsonRpcCall: t,
            requiresRequestAlteration: !1,
            requiresResponseAlteration: !1,
            requiresRequestRedirection: r,
        };
    }
    function y(e) {
        if ("string" == typeof e)
            return e;
        if (e instanceof Uint8Array) {
            return new TextDecoder("utf-8").decode(e);
        }
    }
    document.documentElement.removeAttribute("data-odi-sessionId"),
        (window.fetch = new Proxy(e, {
            apply: async function (e, t, r) {
                try {
                    const n = r && r.length > 1 && r[1] ? r[1].signal : void 0;
                    if (n && n.aborted)
                        return Promise.reject(new DOMException("Request was aborted", "AbortError"));
                    const o = await u(r, "FETCH", { target: e, thisArg: t, signal: n });
                    return o.intercepted
                        ? ((s = o.plaintextResponse),
                            new Response(JSON.stringify(s.body), {
                                headers: new Headers(s.headers),
                                status: s.status,
                                statusText: s.statusText,
                            }))
                        : (r && r.length > 1 && (r[1] = { ...r[1], signal: n }),
                            Reflect.apply(e, t, r));
                }
                catch (s) {
                    return console.error(s), Reflect.apply(e, t, r);
                }
                var s;
            },
        })),
        window.addEventListener("message", (e) => {
            if (e.source !== window)
                return;
            const { id: t, type: r, sessionId: s, response: o } = e.data;
            if (r && t && "ODI_RESPONSE" === r && s === i && n.has(t)) {
                const { resolve: e, timeOut: r } = n.get(t);
                e(o), clearTimeout(r), n.delete(t);
            }
        });
})();
